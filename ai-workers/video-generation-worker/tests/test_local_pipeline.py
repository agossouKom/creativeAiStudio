import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.events import parse_generation_command
from app.local_pipeline import (
    LocalVideoPipelineProvider,
    PipelineError,
)
from app.settings import Settings


class FakeResponse:
    def __init__(self, payload=None, *, content=None, headers=None):
        self.payload = payload
        self.content = content
        self.headers = headers or {}

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload

    def iter_content(self, chunk_size):
        yield self.content

    def close(self):
        return None


class FakeSession:
    def __init__(self, storyboard, *, openai_compatible=False):
        self.storyboard = storyboard
        self.openai_compatible = openai_compatible
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if self.openai_compatible:
            return FakeResponse(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(self.storyboard),
                            }
                        }
                    ]
                }
            )
        return FakeResponse({"response": json.dumps(self.storyboard)})

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        if url == "https://api.pexels.com/videos/search":
            return FakeResponse(
                {
                    "videos": [
                        {
                            "video_files": [
                                {
                                    "link": "https://videos.pexels.com/video-files/1.mp4",
                                    "width": 1280,
                                    "height": 720,
                                    "quality": "hd",
                                }
                            ]
                        }
                    ]
                }
            )
        return FakeResponse(
            content=b"\x00\x00\x00\x18ftypmp42video",
            headers={"Content-Type": "video/mp4"},
        )


class LocalPipelineTest(unittest.TestCase):
    def _command(self, **options):
        return parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A short video about forests",
                "options": {
                    "clipDurationSeconds": 4,
                    "subtitles": True,
                    **options,
                },
            }
        )

    def _storyboard(self):
        return {
            "title": "Forest life",
            "duration": 4,
            "scenes": [
                {
                    "duration": 2,
                    "narration": "Forests support life.",
                    "visual_prompt": "A forest",
                    "keywords": ["forest", "trees"],
                },
                {
                    "duration": 2,
                    "narration": "Protect these habitats.",
                    "visual_prompt": "A green forest",
                    "keywords": ["woods", "nature"],
                },
            ],
        }

    def _settings(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "local",
            "PEXELS_API_KEY": "test-key",
            "VIDEO_GENERATION_MAX_POLL_SECONDS": "60",
        }
        with patch.dict("os.environ", environment, clear=True):
            return Settings.from_env()

    def test_validates_storyboard_duration_and_scene_fields(self):
        valid = LocalVideoPipelineProvider._validate_storyboard(self._storyboard(), 4)
        self.assertEqual(sum(scene["duration"] for scene in valid["scenes"]), 4)
        invalid = self._storyboard()
        invalid["scenes"][0]["duration"] = 3
        with self.assertRaisesRegex(PipelineError, "do not match"):
            LocalVideoPipelineProvider._validate_storyboard(invalid, 4)

    def test_edge_tts_uses_selected_neural_voice_without_api_key(self):
        environment = {"VIDEO_GENERATION_TTS_PROVIDER": "edge"}
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        commands = []

        def fake_process(args, **kwargs):
            commands.append(args)
            Path(args[args.index("--write-media") + 1]).write_bytes(b"audio")
            return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

        provider = LocalVideoPipelineProvider(settings, run_process=fake_process)
        command = self._command(language="fr", voice="fr-FR-HenriNeural")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "voice.mp3"
            provider._synthesize_voiceover(
                command, "Bonjour.", Path(directory) / "narration.txt", output
            )
            self.assertTrue(output.is_file())

        self.assertEqual(commands[0][0], "edge-tts")
        self.assertEqual(commands[0][commands[0].index("--voice") + 1], "fr-FR-HenriNeural")
        self.assertIn("Bonjour.", commands[0])

    def test_espeak_maps_edge_voice_selection_to_language(self):
        command = self._command(language="fr", voice="fr-FR-DeniseNeural")
        self.assertEqual(LocalVideoPipelineProvider._voice_name(command), "fr")

    def test_rejects_missing_stock_api_key_without_fallback(self):
        with patch.dict(
            "os.environ",
            {"VIDEO_GENERATION_PROVIDER": "local"},
            clear=True,
        ):
            provider = LocalVideoPipelineProvider(Settings.from_env())
            with self.assertRaisesRegex(PipelineError, "PEXELS_API_KEY"):
                provider.wait(self._command(), lambda *_: None)

    def test_download_rejects_untrusted_host(self):
        provider = LocalVideoPipelineProvider(self._settings())
        provider.session = FakeSession(self._storyboard())
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                provider.session,
                "get",
                return_value=FakeResponse(
                    {
                        "videos": [
                            {
                                "video_files": [
                                    {
                                        "link": "https://evil.example/video.mp4",
                                        "width": 640,
                                        "height": 360,
                                    }
                                ]
                            }
                        ]
                    }
                ),
            ):
                with self.assertRaisesRegex(PipelineError, "untrusted"):
                    provider._download_stock_video(
                        "pexels",
                        ["forest"],
                        "16:9",
                        Path(directory) / "video.mp4",
                    )

    def test_prefers_smallest_hd_candidate_to_stay_under_download_limit(self):
        provider = LocalVideoPipelineProvider(self._settings())
        provider.session = FakeSession(self._storyboard())
        files = [
            {"link": "https://videos.pexels.com/video-files/uhd.mp4",
             "width": 3840, "height": 2160, "quality": "uhd"},
            {"link": "https://videos.pexels.com/video-files/hd.mp4",
             "width": 1920, "height": 1080, "quality": "hd"},
            {"link": "https://videos.pexels.com/video-files/sd.mp4",
             "width": 640, "height": 360, "quality": "sd"},
        ]
        attempted = []

        def fake_fetch(video_url, destination, max_bytes):
            attempted.append(video_url)
            destination.write_bytes(b"\x00\x00\x00\x18ftypmp42video")

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                provider.session,
                "get",
                return_value=FakeResponse({"videos": [{"video_files": files}]}),
            ), patch.object(provider, "_fetch_stock_media", side_effect=fake_fetch):
                provider._download_stock_video(
                    "pexels",
                    ["forest"],
                    "16:9",
                    Path(directory) / "video.mp4",
                )
        # Le HD le plus petit passe avant le 4K, qui depasse la limite de taille.
        self.assertEqual(attempted, ["https://videos.pexels.com/video-files/hd.mp4"])

    def test_falls_back_to_next_candidate_when_first_exceeds_limit(self):
        provider = LocalVideoPipelineProvider(self._settings())
        provider.session = FakeSession(self._storyboard())
        files = [
            {"link": "https://videos.pexels.com/video-files/hd.mp4",
             "width": 1920, "height": 1080, "quality": "hd"},
            {"link": "https://videos.pexels.com/video-files/sd.mp4",
             "width": 640, "height": 360, "quality": "sd"},
        ]
        attempted = []

        def fake_fetch(video_url, destination, max_bytes):
            attempted.append(video_url)
            if len(attempted) == 1:
                raise PipelineError("STOCK_MEDIA_TOO_LARGE", "too large")
            destination.write_bytes(b"\x00\x00\x00\x18ftypmp42video")

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                provider.session,
                "get",
                return_value=FakeResponse({"videos": [{"video_files": files}]}),
            ), patch.object(provider, "_fetch_stock_media", side_effect=fake_fetch):
                provider._download_stock_video(
                    "pexels",
                    ["forest"],
                    "16:9",
                    Path(directory) / "video.mp4",
                )
        self.assertEqual(attempted, [
            "https://videos.pexels.com/video-files/hd.mp4",
            "https://videos.pexels.com/video-files/sd.mp4",
        ])

    def test_renders_a_storyboard_and_reports_monotonic_progress(self):
        session = FakeSession(self._storyboard())

        def fake_process(args, **kwargs):
            if args[0] == "ffprobe":
                return subprocess.CompletedProcess(
                    args,
                    0,
                    stdout=json.dumps(
                        {
                            "format": {"duration": "4.0"},
                            "streams": [
                                {
                                    "codec_type": "video",
                                    "codec_name": "h264",
                                    "width": 720,
                                    "height": 1280,
                                },
                                {"codec_type": "audio", "codec_name": "aac"},
                            ],
                        }
                    ),
                    stderr="",
                )
            if "-w" in args:
                Path(args[args.index("-w") + 1]).write_bytes(b"RIFF" + b"\x00" * 32)
            elif args[-1].endswith(".mp4"):
                Path(args[-1]).write_bytes(b"\x00\x00\x00\x18ftypmp42video")
            elif args[-1].endswith(".wav"):
                Path(args[-1]).write_bytes(b"RIFF" + b"\x00" * 32)
            return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

        provider = LocalVideoPipelineProvider(
            self._settings(), session=session, run_process=fake_process
        )
        progress = []
        task = provider.wait(self._command(), lambda value, stage, _: progress.append((value, stage)))
        try:
            self.assertEqual(len(task.outputs), 1)
            self.assertEqual(task.outputs[0].suffix, ".mp4")
            self.assertEqual(progress[-1][1], "FINALIZE")
            self.assertEqual(progress, sorted(progress, key=lambda event: event[0]))
            self.assertTrue(any(stage == "VOICEOVER" for _, stage in progress))
            self.assertTrue(any(stage == "MUSIC" for _, stage in progress))
            self.assertTrue(any(stage == "COMPOSITION" for _, stage in progress))
            self.assertTrue(any(stage == "QUALITY_CHECK" for _, stage in progress))
        finally:
            task.cleanup()

    def test_openai_compatible_storyboard_uses_configured_endpoint_and_validates_json(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "local",
            "VIDEO_GENERATION_LLM_PROVIDER": "deepseek",
            "VIDEO_GENERATION_LLM_BASE_URL": "https://api.deepseek.com/v1",
            "VIDEO_GENERATION_LLM_API_KEY": "test-key",
            "VIDEO_GENERATION_LLM_MODEL": "deepseek-chat",
            "PEXELS_API_KEY": "test-key",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        session = FakeSession(self._storyboard(), openai_compatible=True)
        provider = LocalVideoPipelineProvider(settings, session=session)

        result = provider._storyboard(self._command(), 0)

        self.assertEqual(result["title"], "Forest life")
        method, url, kwargs = session.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://api.deepseek.com/v1/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"]["model"], "deepseek-chat")

    def test_openai_compatible_storyboard_rejects_invalid_json(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "local",
            "VIDEO_GENERATION_LLM_PROVIDER": "openai_compatible",
            "VIDEO_GENERATION_LLM_BASE_URL": "https://api.groq.com/openai",
            "VIDEO_GENERATION_LLM_API_KEY": "test-key",
            "VIDEO_GENERATION_LLM_MODEL": "llama-3.1-8b-instant",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        session = FakeSession(self._storyboard(), openai_compatible=True)
        session.post = lambda *_args, **_kwargs: FakeResponse(
            {"choices": [{"message": {"content": "not-json"}}]}
        )
        provider = LocalVideoPipelineProvider(settings, session=session)

        with self.assertRaisesRegex(PipelineError, "malformed storyboard JSON"):
            provider._storyboard(self._command(), 0)

    def test_uses_agent_storyboard_without_calling_worker_llm(self):
        storyboard = self._storyboard()
        command = parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A short video about forests",
                "options": {"clipDurationSeconds": 4, "videoCount": 1},
                "storyboards": [storyboard],
            }
        )
        provider = LocalVideoPipelineProvider(
            self._settings(),
            session=FakeSession(self._storyboard()),
        )
        provider.session.post = lambda *_args, **_kwargs: self.fail(
            "worker LLM must not be called when storyboard is supplied"
        )

        self.assertEqual(provider._storyboard(command, 0), storyboard)


if __name__ == "__main__":
    unittest.main()
