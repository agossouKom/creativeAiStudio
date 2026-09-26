import unittest

from app.events import parse_generation_command
from app.moneyprinter import MoneyPrinterClient, ProviderTask


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.responses.pop(0)


class MoneyPrinterClientTest(unittest.TestCase):
    def _command(self):
        return parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            }
        )

    def test_create_uses_authenticated_video_endpoint(self):
        session = FakeSession(
            [FakeResponse({"status": 200, "data": {"task_id": "provider-1"}})]
        )
        client = MoneyPrinterClient(
            "http://moneyprinter:8080",
            "secret",
            10,
            3,
            15,
            session=session,
        )
        task_id = client.create(self._command())
        self.assertEqual(task_id, "provider-1")
        method, url, kwargs = session.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "http://moneyprinter:8080/api/v1/videos")
        self.assertEqual(kwargs["headers"]["x-api-key"], "secret")
        self.assertEqual(kwargs["headers"]["x-task-id"], "job-1")

    def test_task_response_is_normalized(self):
        session = FakeSession(
            [
                FakeResponse(
                    {
                        "status": 200,
                        "data": {
                            "task_id": "provider-1",
                            "state": 1,
                            "progress": 100,
                            "combined_videos": ["/tasks/provider-1/final-1.mp4"],
                        },
                    }
                )
            ]
        )
        client = MoneyPrinterClient(
            "http://moneyprinter:8080",
            "secret",
            10,
            3,
            15,
            session=session,
        )
        task = client.get_task("provider-1")
        self.assertIsInstance(task, ProviderTask)
        self.assertEqual(task.outputs, ("/tasks/provider-1/final-1.mp4",))


if __name__ == "__main__":
    unittest.main()
