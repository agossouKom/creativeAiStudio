import base64
import unittest

from app.kafka_worker import process_event
from app.provider import GeneratedImages, ImageProviderError, ProviderImage
from app.storage import StorageError, StoredObject


PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"pixel" * 8).decode()


class FakeClient:
    def __init__(self, error=None):
        self.error = error
        self.commands = []

    def generate(self, command):
        self.commands.append(command)
        if self.error:
            raise self.error
        return GeneratedImages(
            model="default-model",
            images=(
                ProviderImage(index=1, base64_data=PNG, url=None, revised_prompt=None),
            ),
        )


class FakeStorage:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def store_base64(self, value, **kwargs):
        self.calls.append(("base64", value, kwargs))
        if self.error:
            raise self.error
        return StoredObject(
            bucket="image-generation-results",
            object_key=f"results/{kwargs['job_id']}/{kwargs['execution_version']}/image-{kwargs['index']}.png",
            size_bytes=10,
            sha256="a" * 64,
            content_type="image/png",
        )

    def store_url(self, url, **kwargs):
        self.calls.append(("url", url, kwargs))
        if self.error:
            raise self.error
        return StoredObject(
            bucket="image-generation-results",
            object_key="results/job-1/1/image-1.png",
            size_bytes=10,
            sha256="a" * 64,
            content_type="image/png",
        )


def _event(**overrides):
    payload = {
        "schemaVersion": 1,
        "eventId": "event-1",
        "jobId": "job-1",
        "userId": "user-1",
        "prompt": "A neon city at night",
    }
    payload.update(overrides)
    return payload


class ProcessEventTest(unittest.TestCase):
    def test_publishes_durable_result_after_storage(self):
        events = []
        process_event(_event(), FakeClient(), FakeStorage(), events.append)
        self.assertEqual([event["type"] for event in events], [
            "PROGRESS",
            "PROGRESS",
            "PROGRESS",
            "COMPLETED",
        ])
        result = events[-1]
        self.assertEqual(result["stage"], "FINALIZE")
        self.assertEqual(result["status"], "DONE")
        self.assertFalse(result["result"]["storageRequired"])
        self.assertEqual(result["result"]["outputs"][0]["objectKey"], "results/job-1/1/image-1.png")
        self.assertNotIn(PNG, str(result))

    def test_stores_url_outputs(self):
        class UrlClient(FakeClient):
            def generate(self, command):
                return GeneratedImages(
                    model="m",
                    images=(ProviderImage(1, None, "https://cdn.test/1.png", None),),
                )

        storage = FakeStorage()
        events = []
        process_event(_event(), UrlClient(), storage, events.append)
        self.assertEqual(storage.calls[0][0], "url")
        self.assertEqual(storage.calls[0][1], "https://cdn.test/1.png")
        self.assertEqual(events[-1]["type"], "COMPLETED")

    def test_storage_failure_never_publishes_completed(self):
        events = []
        storage = FakeStorage(StorageError("OUTPUT_TOO_LARGE", "too large"))
        process_event(_event(), FakeClient(), storage, events.append)
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["stage"], "STORAGE")
        self.assertEqual(events[-1]["error"]["code"], "OUTPUT_TOO_LARGE")
        self.assertFalse(any(event["type"] == "COMPLETED" for event in events))

    def test_missing_storage_fails_before_completion(self):
        events = []
        process_event(_event(), FakeClient(), None, events.append)
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["error"]["code"], "STORAGE_NOT_CONFIGURED")

    def test_provider_failure_is_reported(self):
        events = []
        client = FakeClient(ImageProviderError("PROVIDER_AUTH_ERROR", "bad key"))
        process_event(_event(), client, FakeStorage(), events.append)
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["error"]["code"], "PROVIDER_AUTH_ERROR")
        self.assertEqual(events[-1]["stage"], "FAILED")

    def test_invalid_event_fails_validation(self):
        events = []
        process_event({"jobId": "job-1", "prompt": ""}, FakeClient(), FakeStorage(), events.append)
        self.assertEqual(events[-1]["type"], "FAILED")
        self.assertEqual(events[-1]["stage"], "VALIDATING")
        self.assertEqual(len(events), 1)

    def test_uses_command_identity_for_storage(self):
        storage = FakeStorage()
        process_event(
            _event(executionVersion=5, jobId="job-42"),
            FakeClient(),
            storage,
            lambda payload: None,
        )
        self.assertEqual(storage.calls[0][2]["job_id"], "job-42")
        self.assertEqual(storage.calls[0][2]["execution_version"], 5)

    def test_passes_command_to_provider(self):
        client = FakeClient()
        process_event(_event(options={"count": 2, "size": "512x512"}), client, FakeStorage(), lambda payload: None)
        self.assertEqual(client.commands[0].options.count, 2)
        self.assertEqual(client.commands[0].options.size, "512x512")


if __name__ == "__main__":
    unittest.main()
