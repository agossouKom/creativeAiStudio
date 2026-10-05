from __future__ import annotations

import hashlib
import json
import logging
import math
import random
import subprocess
import tempfile
import textwrap
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping
from urllib.parse import urlsplit

import requests

from .events import GenerationCommand
from .settings import Settings


logger = logging.getLogger(__name__)
Progress = Callable[[int, str, str], None]
_MAX_STORYBOARD_SCENES = 12
_ALLOWED_MEDIA_HOSTS = {
    "videos.pexels.com",
    "cdn.pixabay.com",
}
_STORYBOARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["title", "duration", "scenes"],
    "properties": {
        "title": {"type": "string"},
        "duration": {"type": "integer"},
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["duration", "narration", "visual_prompt", "keywords"],
                "properties": {
                    "duration": {"type": "integer"},
                    "narration": {"type": "string"},
                    "visual_prompt": {"type": "string"},
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        },
    },
}


class PipelineError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass
class LocalPipelineTask:
    task_id: str
    outputs: tuple[Path, ...]
    work_dir: tempfile.TemporaryDirectory[str]
    provider: str = "local-ollama-ffmpeg"

    def cleanup(self) -> None:
        self.work_dir.cleanup()

    @staticmethod
    def result_payload(
        task: "LocalPipelineTask", stored_outputs: list[Mapping[str, Any]]
    ) -> dict[str, Any]:
        if not stored_outputs:
            raise ValueError("stored_outputs must not be empty")
        return {
            "provider": task.provider,
            "providerTaskId": task.task_id,
            "outputs": [dict(output) for output in stored_outputs],
            "outputCount": len(stored_outputs),
            "storageRequired": False,
        }


class LocalVideoPipelineProvider:
    def __init__(
        self,
        settings: Settings,
        *,
        session: requests.Session | None = None,
        run_process: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    ):
        self.settings = settings
        self.session = session or requests.Session()
        self.run_process = run_process

    def wait(
        self, command: GenerationCommand, on_progress: Progress
    ) -> LocalPipelineTask:
        if command.options.video_count > self.settings.max_video_count:
            raise PipelineError("INVALID_OPTIONS", "videoCount exceeds the worker limit")
        if command.options.clip_duration_seconds > self.settings.max_clip_duration_seconds:
            raise PipelineError(
                "INVALID_OPTIONS", "clipDurationSeconds exceeds the worker limit"
            )
        if command.options.source == "pexels" and not self.settings.pexels_api_key:
            raise PipelineError("STOCK_API_KEY_MISSING", "PEXELS_API_KEY is required")
        if command.options.source == "pixabay" and not self.settings.pixabay_api_key:
            raise PipelineError("STOCK_API_KEY_MISSING", "PIXABAY_API_KEY is required")
        if command.options.source == "coverr":
            raise PipelineError(
                "SOURCE_NOT_CONFIGURED",
                "Coverr is not integrated; select Pexels or Pixabay",
            )

        work_dir = tempfile.TemporaryDirectory(prefix="creativeai-video-")
        task_id = f"local-{uuid.uuid4()}"
        outputs: list[Path] = []
        try:
            for video_index in range(command.options.video_count):
                storyboard = self._storyboard(command, video_index)
                video_progress = lambda progress, stage, provider_task_id: on_progress(
                    10
                    + int(
                        80
                        * (video_index + progress / 100)
                        / command.options.video_count
                    ),
                    stage,
                    provider_task_id,
                )
                video_progress(0, "SCRIPT", task_id)
                output = self._render(
                    command,
                    storyboard,
                    Path(work_dir.name) / f"video-{video_index + 1}.mp4",
                    Path(work_dir.name) / f"video-{video_index + 1}",
                    task_id,
                    video_progress,
                )
                outputs.append(output)
            on_progress(90, "QUALITY_CHECK", task_id)
            for output in outputs:
                self._quality_check(output, command)
            on_progress(94, "FINALIZE", task_id)
            provider_name = (
                "local-agent-llm-ffmpeg"
                if command.storyboards
                else "local-ollama-ffmpeg"
                if self.settings.storyboard_llm_provider == "ollama"
                else f"local-{self.settings.storyboard_llm_provider}-ffmpeg"
            )
            return LocalPipelineTask(
                task_id, tuple(outputs), work_dir, provider=provider_name
            )
        except Exception:
            work_dir.cleanup()
            raise

    def _storyboard(self, command: GenerationCommand, variation: int) -> dict[str, Any]:
        duration = command.options.clip_duration_seconds
        if command.storyboards:
            if variation >= len(command.storyboards):
                raise PipelineError(
                    "INVALID_STORYBOARD", "No storyboard was supplied for this variation"
                )
            return self._validate_storyboard(
                dict(command.storyboards[variation]), duration
            )
        language = command.options.language or "English"
        prompt = (
            "Create a concise video storyboard as JSON only. "
            "Return exactly the schema requested. The topic is: "
            f"{command.prompt!r}. Write narration in {language}. "
            f"Return duration exactly {duration} seconds, with 2-6 scenes whose "
            "integer durations sum exactly to the requested duration. "
            "Each scene needs original narration, a literal stock-video search "
            "phrase in visual_prompt, and 2-5 concise search keywords. "
            f"This is variation {variation + 1}; make it distinct."
        )
        if self.settings.storyboard_llm_provider != "ollama":
            return self._openai_compatible_storyboard(prompt, duration)

        try:
            response = self.session.post(
                f"{self.settings.ollama_url}/api/generate",
                json={
                    "model": self.settings.ollama_model,
                    "prompt": prompt,
                    "format": _STORYBOARD_SCHEMA,
                    "stream": False,
                    "options": {"temperature": 0.5},
                },
                timeout=(5, self.settings.max_poll_seconds),
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise PipelineError(
                "OLLAMA_UNAVAILABLE", "Ollama could not generate the video storyboard"
            ) from exc
        except (ValueError, TypeError) as exc:
            raise PipelineError(
                "INVALID_STORYBOARD", "Ollama returned an invalid storyboard response"
            ) from exc
        if not isinstance(payload, Mapping) or not isinstance(payload.get("response"), str):
            raise PipelineError(
                "INVALID_STORYBOARD", "Ollama response did not contain storyboard JSON"
            )
        return self._parse_storyboard(payload["response"], duration)

    def _openai_compatible_storyboard(
        self, prompt: str, duration: int
    ) -> dict[str, Any]:
        base_url = self.settings.storyboard_llm_base_url
        api_key = self.settings.storyboard_llm_api_key
        model = self.settings.storyboard_llm_model
        if (
            not base_url
            or not model
            or (not api_key and not self.settings.storyboard_llm_allow_unauthenticated)
        ):
            # Le modèle n'a plus de défaut codé en dur : on nomme la variable
            # manquante pour que le config soit actionnable depuis le job.
            missing = []
            if not base_url:
                missing.append("VIDEO_GENERATION_LLM_BASE_URL")
            if not model:
                missing.append("VIDEO_GENERATION_LLM_MODEL")
            if not api_key and not self.settings.storyboard_llm_allow_unauthenticated:
                missing.append("VIDEO_GENERATION_LLM_API_KEY")
            raise PipelineError(
                "STORYBOARD_PROVIDER_NOT_CONFIGURED",
                "Storyboard LLM provider is not configured: "
                + ", ".join(missing)
                + " are missing for provider "
                + self.settings.storyboard_llm_provider,
            )
        endpoint = (
            f"{base_url}/chat/completions"
            if base_url.endswith("/v1")
            else f"{base_url}/v1/chat/completions"
        )
        schema = json.dumps(_STORYBOARD_SCHEMA, ensure_ascii=False)
        try:
            response = self.session.post(
                endpoint,
                headers=(
                    {"Authorization": f"Bearer {api_key}"} if api_key else {}
                ),
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Return only a valid JSON object matching this JSON "
                                f"schema: {schema}"
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.5,
                    "max_tokens": 1600,
                    "response_format": {"type": "json_object"},
                },
                timeout=(5, self.settings.storyboard_llm_timeout_seconds),
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise PipelineError(
                "STORYBOARD_PROVIDER_UNAVAILABLE",
                "The configured storyboard LLM provider is unavailable",
            ) from exc
        except (ValueError, TypeError) as exc:
            raise PipelineError(
                "INVALID_STORYBOARD", "LLM provider returned an invalid response"
            ) from exc
        content = (
            payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
            if isinstance(payload, Mapping)
            and isinstance(payload.get("choices"), list)
            and payload["choices"]
            and isinstance(payload["choices"][0], Mapping)
            and isinstance(payload["choices"][0].get("message"), Mapping)
            else None
        )
        if not isinstance(content, str):
            raise PipelineError(
                "INVALID_STORYBOARD",
                "LLM provider response did not contain storyboard text",
            )
        return self._parse_storyboard(content, duration)

    def _parse_storyboard(self, content: str, duration: int) -> dict[str, Any]:
        try:
            storyboard = json.loads(content)
        except json.JSONDecodeError as exc:
            raise PipelineError(
                "INVALID_STORYBOARD", "LLM provider returned malformed storyboard JSON"
            ) from exc
        return self._validate_storyboard(storyboard, duration)

    @staticmethod
    def _validate_storyboard(value: Any, requested_duration: int) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise PipelineError("INVALID_STORYBOARD", "storyboard must be a JSON object")
        title = value.get("title")
        duration = value.get("duration")
        scenes = value.get("scenes")
        if (
            not isinstance(title, str)
            or not title.strip()
            or len(title) > 160
            or isinstance(duration, bool)
            or not isinstance(duration, int)
            or duration != requested_duration
            or not isinstance(scenes, list)
            or not 1 <= len(scenes) <= _MAX_STORYBOARD_SCENES
        ):
            raise PipelineError("INVALID_STORYBOARD", "storyboard fields are invalid")
        normalized_scenes: list[dict[str, Any]] = []
        for scene in scenes:
            if not isinstance(scene, dict):
                raise PipelineError("INVALID_STORYBOARD", "storyboard scene must be an object")
            scene_duration = scene.get("duration")
            narration = scene.get("narration")
            visual_prompt = scene.get("visual_prompt")
            keywords = scene.get("keywords")
            if (
                isinstance(scene_duration, bool)
                or not isinstance(scene_duration, int)
                or scene_duration < 1
                or not isinstance(narration, str)
                or not narration.strip()
                or len(narration) > 1000
                or not isinstance(visual_prompt, str)
                or not visual_prompt.strip()
                or len(visual_prompt) > 300
                or not isinstance(keywords, list)
                or not 1 <= len(keywords) <= 10
                or any(not isinstance(word, str) or not word.strip() or len(word) > 80 for word in keywords)
            ):
                raise PipelineError("INVALID_STORYBOARD", "storyboard scene fields are invalid")
            normalized_scenes.append(
                {
                    "duration": scene_duration,
                    "narration": narration.strip(),
                    "visual_prompt": visual_prompt.strip(),
                    "keywords": [word.strip() for word in keywords],
                }
            )
        if sum(scene["duration"] for scene in normalized_scenes) != requested_duration:
            raise PipelineError(
                "INVALID_STORYBOARD", "scene durations do not match the requested duration"
            )
        return {
            "title": title.strip(),
            "duration": requested_duration,
            "scenes": normalized_scenes,
        }

    def _render(
        self,
        command: GenerationCommand,
        storyboard: Mapping[str, Any],
        output: Path,
        work_dir: Path,
        task_id: str,
        on_progress: Progress,
    ) -> Path:
        work_dir.mkdir(parents=True, exist_ok=False)
        scenes = storyboard["scenes"]
        normalized_videos: list[Path] = []
        normalized_audio: list[Path] = []
        subtitles: list[str] = []
        elapsed = 0
        width, height = {
            "16:9": (1280, 720),
            "9:16": (720, 1280),
            "1:1": (1080, 1080),
        }[command.options.aspect_ratio]
        for index, scene in enumerate(scenes):
            on_progress(
                15 + int(index * 60 / len(scenes)),
                "VISUALS",
                task_id,
            )
            source = work_dir / f"source-{index + 1}.mp4"
            self._download_stock_video(
                command.options.source,
                scene["keywords"],
                command.options.aspect_ratio,
                source,
                max_bytes=max(
                    1,
                    self.settings.video_generation_max_source_bytes
                    // (command.options.video_count * len(scenes)),
                ),
            )
            normalized_video = work_dir / f"scene-{index + 1}.mp4"
            self._run(
                [
                    self.settings.ffmpeg_binary,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-stream_loop",
                    "-1",
                    "-i",
                    str(source),
                    "-t",
                    str(scene["duration"]),
                    "-vf",
                    f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                    f"crop={width}:{height},fps=30,format=yuv420p",
                    "-an",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "ultrafast",
                    str(normalized_video),
                ],
                "VIDEO_RENDER_FAILED",
            )
            normalized_videos.append(normalized_video)
            if command.options.subtitles:
                subtitles.append(
                    f"{self._srt_timestamp(elapsed)} --> "
                    f"{self._srt_timestamp(elapsed + scene['duration'])}\n"
                    f"{textwrap.fill(scene['narration'].replace(chr(10), ' '), 64)}"
                )
            elapsed += scene["duration"]

            on_progress(
                15 + int((index * 60 + 30) / len(scenes)),
                "VOICEOVER",
                task_id,
            )
            audio_extension = "mp3" if self.settings.tts_provider == "edge" else "wav"
            raw_audio = work_dir / f"voice-raw-{index + 1}.{audio_extension}"
            narration_file = work_dir / f"narration-{index + 1}.txt"
            narration_file.write_text(scene["narration"], encoding="utf-8")
            self._synthesize_voiceover(
                command, scene["narration"], narration_file, raw_audio
            )
            segment_audio = work_dir / f"voice-{index + 1}.wav"
            self._run(
                [
                    self.settings.ffmpeg_binary,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(raw_audio),
                    "-af",
                    "apad",
                    "-t",
                    str(scene["duration"]),
                    "-ar",
                    "44100",
                    "-ac",
                    "2",
                    str(segment_audio),
                ],
                "VOICEOVER_FAILED",
            )
            normalized_audio.append(segment_audio)

        if command.options.subtitles:
            subtitle_file = work_dir / "subtitles.srt"
            subtitle_file.write_text("\n\n".join(
                f"{index + 1}\n{entry}" for index, entry in enumerate(subtitles)
            ) + "\n", encoding="utf-8")

        video_input = work_dir / "video-input.txt"
        video_input.write_text(
            "".join(f"file '{path.name}'\n" for path in normalized_videos),
            encoding="utf-8",
        )
        video_only = work_dir / "video-only.mp4"
        self._run(
            [
                self.settings.ffmpeg_binary,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(video_input),
                "-c",
                "copy",
                str(video_only),
            ],
            "VIDEO_RENDER_FAILED",
            cwd=work_dir,
        )
        audio_input = work_dir / "audio-input.txt"
        audio_input.write_text(
            "".join(f"file '{path.name}'\n" for path in normalized_audio),
            encoding="utf-8",
        )
        voice_track = work_dir / "voice-track.wav"
        self._run(
            [
                self.settings.ffmpeg_binary,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(audio_input),
                "-c:a",
                "pcm_s16le",
                str(voice_track),
            ],
            "VOICEOVER_FAILED",
            cwd=work_dir,
        )
        on_progress(82, "SUBTITLES", task_id)
        on_progress(85, "MUSIC", task_id)
        on_progress(87, "COMPOSITION", task_id)
        self._mux_final(
            command,
            storyboard,
            video_only,
            voice_track,
            output,
            work_dir,
        )
        return output

    def _download_stock_video(
        self,
        source: str,
        keywords: list[str],
        aspect_ratio: str,
        destination: Path,
        *,
        max_bytes: int | None = None,
    ) -> None:
        query = " ".join(keywords[:5])
        try:
            if source == "pexels":
                response = self.session.get(
                    "https://api.pexels.com/videos/search",
                    headers={"Authorization": self.settings.pexels_api_key or ""},
                    params={
                        "query": query,
                        "per_page": 10,
                        "orientation": {
                            "16:9": "landscape",
                            "9:16": "portrait",
                            "1:1": "square",
                        }[aspect_ratio],
                    },
                    timeout=self.settings.request_timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
                videos = payload.get("videos", []) if isinstance(payload, Mapping) else []
                candidates = [
                    item
                    for video in videos if isinstance(video, Mapping)
                    for item in video.get("video_files", [])
                    if isinstance(item, Mapping) and item.get("link")
                ]
                # Du plus petit au plus grand : un clip 4K dépasse la limite de
                # telechargement alors que le meme plan existe en 1080p. Les
                # candidats plus gros restent tries derriere, donc le fallback
                # (_download_stock_video) peut encore les essayer.
                candidates.sort(
                    key=lambda item: (
                        not item.get("quality") == "hd",
                        item.get("width", 0) * item.get("height", 0),
                    ),
                )
                video_urls = [item["link"] for item in candidates]
            elif source == "pixabay":
                response = self.session.get(
                    "https://pixabay.com/api/videos/",
                    params={
                        "key": self.settings.pixabay_api_key,
                        "q": query,
                        "per_page": 10,
                        "safesearch": "true",
                    },
                    timeout=self.settings.request_timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
                hits = payload.get("hits", []) if isinstance(payload, Mapping) else []
                candidates = []
                for hit in hits:
                    if not isinstance(hit, Mapping) or not isinstance(hit.get("videos"), Mapping):
                        continue
                    for size in ("large", "medium", "small", "tiny"):
                        media = hit["videos"].get(size)
                        if isinstance(media, Mapping) and media.get("url"):
                            width = media.get("width", 0)
                            candidates.append(
                                (media["url"], width if isinstance(width, int) else 0)
                            )
                # Idem : on privilegie les plus petites resolutions pour rester
                # sous la limite de taille, en gardant les plus grandes en repli.
                candidates.sort(key=lambda entry: entry[1])
                video_urls = [url for url, _ in candidates]
            else:
                raise PipelineError(
                    "SOURCE_NOT_CONFIGURED",
                    "Coverr is not integrated; select Pexels or Pixabay",
                )
        except requests.RequestException as exc:
            raise PipelineError(
                "STOCK_PROVIDER_UNAVAILABLE", f"{source} search failed"
            ) from exc
        except (ValueError, TypeError, KeyError) as exc:
            raise PipelineError(
                "STOCK_PROVIDER_RESPONSE_INVALID", f"{source} returned invalid media metadata"
            ) from exc
        if not video_urls:
            raise PipelineError("STOCK_MEDIA_NOT_FOUND", f"{source} returned no matching video")

        # Les candidats sont tries du plus petit au plus grand (qualite HD
        # d'abord) : un media trop gros, invalide ou en erreur ne doit pas faire
        # echouer le job alors que le fournisseur en a renvoye d'autres.
        last_error: PipelineError | None = None
        for video_url in video_urls:
            destination.unlink(missing_ok=True)
            try:
                self._fetch_stock_media(video_url, destination, max_bytes)
                return
            except PipelineError as exc:
                last_error = exc
                logger.warning("Candidat de média ignoré (%s): %s", exc.code, exc)
        destination.unlink(missing_ok=True)
        raise last_error or PipelineError(
            "STOCK_MEDIA_NOT_FOUND", f"{source} returned no usable video"
        )

    def _fetch_stock_media(
        self, video_url: str, destination: Path, max_bytes: int | None
    ) -> None:
        parsed = urlsplit(video_url)
        if (
            parsed.scheme != "https"
            or parsed.hostname not in _ALLOWED_MEDIA_HOSTS
            or parsed.username
            or parsed.password
        ):
            raise PipelineError(
                "STOCK_MEDIA_URL_REJECTED", "stock provider returned an untrusted media URL"
            )
        try:
            response = self.session.get(
                video_url,
                stream=True,
                timeout=self.settings.request_timeout_seconds,
                allow_redirects=False,
            )
            response.raise_for_status()
            content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0]
            if content_type and not content_type.startswith("video/"):
                raise PipelineError("STOCK_MEDIA_INVALID", "stock URL did not return video")
            size = 0
            with destination.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > (max_bytes or self.settings.video_generation_max_source_bytes):
                        raise PipelineError(
                            "STOCK_MEDIA_TOO_LARGE", "stock video exceeds the download size limit"
                        )
                    output.write(chunk)
            if size < 12:
                raise PipelineError("STOCK_MEDIA_INVALID", "stock video is empty or invalid")
        except requests.RequestException as exc:
            raise PipelineError(
                "STOCK_MEDIA_DOWNLOAD_FAILED", "stock video could not be downloaded"
            ) from exc
        finally:
            close = getattr(locals().get("response"), "close", None)
            if callable(close):
                close()

    def _mux_final(
        self,
        command: GenerationCommand,
        storyboard: Mapping[str, Any],
        video_only: Path,
        voice_track: Path,
        output: Path,
        work_dir: Path,
    ) -> None:
        args = [
            self.settings.ffmpeg_binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_only),
            "-i",
            str(voice_track),
        ]
        music = self._select_music(command, storyboard)
        if music is not None:
            args.extend(["-stream_loop", "-1", "-i", str(music)])
            args.extend(
                [
                    "-filter_complex",
                    "[1:a]volume=1.0[voice];[2:a]volume=0.12[music];"
                    "[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]",
                    "-map",
                    "0:v:0",
                    "-map",
                    "[a]",
                ]
            )
        else:
            args.extend(["-map", "0:v:0", "-map", "1:a:0"])
        args.extend(
            [
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-t",
                str(command.options.clip_duration_seconds),
            ]
        )
        if command.options.subtitles:
            args.extend(
                [
                    "-vf",
                    "subtitles=subtitles.srt:force_style='Fontsize=20,Outline=1,Alignment=2'",
                ]
            )
        args.extend(["-movflags", "+faststart", str(output)])
        self._run(args, "VIDEO_RENDER_FAILED", cwd=work_dir)

    def _select_music(
        self, command: GenerationCommand, storyboard: Mapping[str, Any]
    ) -> Path | None:
        if not self.settings.music_dir:
            return None
        directory = Path(self.settings.music_dir)
        if not directory.is_dir():
            raise PipelineError("MUSIC_DIRECTORY_INVALID", "configured music directory is unavailable")
        tracks = sorted(
            path for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in {".mp3", ".wav", ".m4a", ".aac", ".ogg"}
        )
        if not tracks:
            raise PipelineError("MUSIC_NOT_FOUND", "configured music directory has no supported tracks")
        seed = int.from_bytes(
            hashlib.sha256(f"{command.job_id}:{storyboard['title']}".encode()).digest()[:8],
            "big",
        )
        return random.Random(seed).choice(tracks)

    def _quality_check(self, output: Path, command: GenerationCommand) -> None:
        if not output.is_file() or output.stat().st_size < 12:
            raise PipelineError("QUALITY_CHECK_FAILED", "rendered video is missing or empty")
        try:
            result = self.run_process(
                [
                    self.settings.ffprobe_binary,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-show_entries",
                    "stream=codec_type,codec_name,width,height",
                    "-of",
                    "json",
                    str(output),
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            metadata = json.loads(result.stdout)
        except (OSError, subprocess.SubprocessError, ValueError) as exc:
            raise PipelineError("QUALITY_CHECK_FAILED", "ffprobe could not inspect rendered video") from exc
        if not isinstance(metadata, Mapping):
            raise PipelineError("QUALITY_CHECK_FAILED", "ffprobe returned invalid media metadata")
        streams = metadata.get("streams", [])
        if not isinstance(streams, list):
            raise PipelineError("QUALITY_CHECK_FAILED", "ffprobe returned invalid media streams")
        video = next(
            (
                stream
                for stream in streams
                if isinstance(stream, Mapping) and stream.get("codec_type") == "video"
            ),
            None,
        )
        audio = next(
            (
                stream
                for stream in streams
                if isinstance(stream, Mapping) and stream.get("codec_type") == "audio"
            ),
            None,
        )
        width, height = {
            "16:9": (1280, 720),
            "9:16": (720, 1280),
            "1:1": (1080, 1080),
        }[command.options.aspect_ratio]
        try:
            duration = float(metadata["format"]["duration"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PipelineError("QUALITY_CHECK_FAILED", "rendered video duration is invalid") from exc
        if (
            video is None
            or audio is None
            or video.get("codec_name") != "h264"
            or audio.get("codec_name") != "aac"
            or video.get("width") != width
            or video.get("height") != height
            or not math.isfinite(duration)
            or duration < command.options.clip_duration_seconds * 0.9
            or duration > command.options.clip_duration_seconds + 1
        ):
            raise PipelineError("QUALITY_CHECK_FAILED", "rendered video failed media checks")

    def _run(
        self,
        args: list[str],
        error_code: str,
        *,
        cwd: Path | None = None,
    ) -> None:
        try:
            result = self.run_process(
                args,
                check=True,
                capture_output=True,
                text=True,
                timeout=max(60, self.settings.max_poll_seconds),
                cwd=cwd,
            )
        except subprocess.CalledProcessError as exc:
            logger.warning("Media command failed: %s", (exc.stderr or "")[-1000:])
            raise PipelineError(error_code, "media processing command failed") from exc
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise PipelineError(error_code, "media processing command is unavailable or timed out") from exc
        if result is not None and result.returncode:
            raise PipelineError(error_code, "media processing command failed")

    @staticmethod
    def _voice_name(command: GenerationCommand) -> str:
        voice = command.options.voice
        if voice:
            if voice.endswith("Neural") and "-" in voice:
                return voice.split("-", 1)[0].lower()
            return voice
        language = (command.options.language or "en").split("-", 1)[0].lower()
        return language if language.isalpha() and len(language) <= 8 else "en"

    @staticmethod
    def _edge_voice_name(command: GenerationCommand) -> str:
        if command.options.voice:
            return command.options.voice
        language = (command.options.language or "fr").split("-", 1)[0].lower()
        return {
            "fr": "fr-FR-DeniseNeural",
            "en": "en-US-AriaNeural",
            "es": "es-ES-ElviraNeural",
            "de": "de-DE-KatjaNeural",
            "it": "it-IT-ElsaNeural",
            "pt": "pt-BR-FranciscaNeural",
        }.get(language, "en-US-AriaNeural")

    def _synthesize_voiceover(
        self,
        command: GenerationCommand,
        narration: str,
        narration_file: Path,
        output: Path,
    ) -> None:
        if self.settings.tts_provider == "edge":
            self._run(
                [
                    self.settings.edge_tts_binary,
                    "--voice",
                    self._edge_voice_name(command),
                    "--text",
                    narration,
                    "--write-media",
                    str(output),
                ],
                "VOICEOVER_FAILED",
            )
            if not output.is_file() or output.stat().st_size == 0:
                raise PipelineError(
                    "VOICEOVER_FAILED", "Edge TTS completed without producing audio"
                )
            return
        self._run(
            [
                self.settings.tts_binary,
                "-v",
                self._voice_name(command),
                "-s",
                "155",
                "-w",
                str(output),
                "-f",
                str(narration_file),
            ],
            "VOICEOVER_FAILED",
        )

    @staticmethod
    def _srt_timestamp(seconds: int) -> str:
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02}:{minutes:02}:{seconds:02},000"
