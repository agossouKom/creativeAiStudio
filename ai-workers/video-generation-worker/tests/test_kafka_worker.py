import tempfile
import unittest
from pathlib import Path

from app.kafka_worker import process_event
from app.local_pipeline import LocalPipelineTask, PipelineError
from app.moneyprinter import ProviderTask
from app.storage import StorageError, StoredObject


class FakeClient:
    base_url = "http://moneyprinter:8080"

    def wait(self, command, on_progress):
        on_progress(50, "COMPOSITION", "provider-1")
        return ProviderTask(
            task_id="provider-1",
            state=1,
            progress=100,
            videos=(),
            combined_videos=("/tasks/provider-1/combined-1.mp4",),
            error=None,
            failed_stage=None,
        )


class FakeStorage:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def store_outputs(self, source_urls, **kwargs):
        self.calls.append((source_urls, kwargs))
        if self.error:
            raise self.error
        return [
            StoredObject(
                bucket="video-generation-results",
                object_key="results/job-1/1/video-1.mp4",
                size_bytes=10,
                sha256="a" * 64,
                content_type="video/mp4",
            )
        ]

    def store_files(self, source_paths, **kwargs):
        self.calls.append((source_paths, kwargs))
        if self.error:
            raise self.error
        return [
            StoredObject(
                bucket="video-generation-results",
                object_key="results/job-1/1/video-1.mp4",
                size_bytes=10,
                sha256="a" * 64,
                content_type="video/mp4",
            )
        ]


class FakeLocalClient:
    def __init__(self, error=None):
        self.error = error
        self.work_dir = None

    def wait(self, command, on_progress):
        if self.error:
            raise self.error
        work_dir = tempfile.TemporaryDirectory(prefix="worker-test-")
        self.work_dir = Path(work_dir.name)
        output = self.work_dir / "video.mp4"
        output.write_bytes(b"\x00\x00\x00\x18ftypmp42video")
        return LocalPipelineTask("local-task", (output,), work_dir)


class ProcessEventTest(unittest.TestCase):
    def test_publishes_durable_result_after_storage(self):
        events = []
        storage = FakeStorage()
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            },
            FakeClient(),
            storage,
            events.append,
        )
        result = events[-1]
        self.assertEqual(result["type"], "COMPLETED")
        self.assertFalse(result["result"]["storageRequired"])
        self.assertEqual(
            result["result"]["outputs"][0]["objectKey"],
            "results/job-1/1/video-1.mp4",
        )
        self.assertNotIn("/tasks/provider-1", str(result))

    def test_storage_failure_never_publishes_completed(self):
        events = []
        storage = FakeStorage(StorageError("OUTPUT_DOWNLOAD_FAILED", "download failed"))
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            },
            FakeClient(),
            storage,
            events.append,
        )
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["stage"], "STORAGE")
        self.assertFalse(any(event["type"] == "COMPLETED" for event in events))

    def test_uses_command_identity_for_storage(self):
        events = []
        storage = FakeStorage()
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "executionVersion": 3,
                "userId": "user-1",
                "prompt": "A video",
            },
            FakeClient(),
            storage,
            events.append,
        )
        self.assertEqual(storage.calls[0][1]["job_id"], "job-1")
        self.assertEqual(storage.calls[0][1]["execution_version"], 3)

    def test_local_pipeline_stores_durable_output_before_completion(self):
        events = []
        storage = FakeStorage()
        client = FakeLocalClient()
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            },
            client,
            storage,
            events.append,
        )
        self.assertEqual(events[-1]["type"], "COMPLETED")
        self.assertEqual(
            events[-1]["result"]["provider"], "local-ollama-ffmpeg"
        )
        self.assertEqual(storage.calls[0][0][0].name, "video.mp4")
        self.assertFalse(client.work_dir.exists())
        progress_values = [
            event["progress"] for event in events if event["type"] == "PROGRESS"
        ]
        self.assertEqual(progress_values, sorted(progress_values))

    def test_local_pipeline_failure_is_reported_without_completion(self):
        events = []
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            },
            FakeLocalClient(PipelineError("OLLAMA_UNAVAILABLE", "Ollama is unavailable")),
            FakeStorage(),
            events.append,
        )
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["error"]["code"], "OLLAMA_UNAVAILABLE")
        self.assertFalse(any(event["type"] == "COMPLETED" for event in events))

    def test_local_storage_failure_cleans_workspace_and_never_completes(self):
        events = []
        client = FakeLocalClient()
        process_event(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            },
            client,
            FakeStorage(StorageError("STORAGE_UNAVAILABLE", "MinIO is unavailable")),
            events.append,
        )
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertFalse(any(event["type"] == "COMPLETED" for event in events))
        self.assertFalse(client.work_dir.exists())


if __name__ == "__main__":
    unittest.main()
