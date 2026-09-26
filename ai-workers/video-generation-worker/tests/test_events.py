import unittest

from app.events import (
    EventValidationError,
    parse_generation_command,
    provider_params,
    result_event,
    validation_failure_event,
)


class EventContractTest(unittest.TestCase):
    def test_parses_supported_command(self):
        command = parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "executionVersion": 2,
                "userId": "user-1",
                "prompt": "A short product introduction",
                "options": {
                    "aspectRatio": "16:9",
                    "language": "en-US",
                    "subtitles": False,
                    "videoCount": 2,
                    "clipDurationSeconds": 8,
                    "source": "pixabay",
                },
            }
        )
        self.assertEqual(command.options.aspect_ratio, "16:9")
        self.assertEqual(command.options.video_count, 2)
        self.assertEqual(provider_params(command)["video_subject"], command.prompt)
        self.assertEqual(provider_params(command)["video_source"], "pixabay")

    def test_rejects_unknown_option(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(
                {
                    "schemaVersion": 1,
                    "eventId": "event-1",
                    "jobId": "job-1",
                    "userId": "user-1",
                    "prompt": "A video",
                    "options": {"providerUrl": "https://example.invalid"},
                }
            )

    def test_rejects_assets_until_storage_adapter_exists(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(
                {
                    "schemaVersion": 1,
                    "eventId": "event-1",
                    "jobId": "job-1",
                    "userId": "user-1",
                    "prompt": "A video",
                    "assets": [{"bucket": "inputs", "objectKey": "image.png"}],
                }
            )

    def test_parses_agent_generated_storyboards_without_provider_credentials(self):
        storyboard = {
            "title": "A launch",
            "duration": 5,
            "scenes": [],
        }
        command = parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A launch",
                "options": {"videoCount": 1},
                "storyboards": [storyboard],
            }
        )
        self.assertEqual(command.storyboards, (storyboard,))

    def test_rejects_storyboard_count_mismatch(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(
                {
                    "schemaVersion": 1,
                    "eventId": "event-1",
                    "jobId": "job-1",
                    "userId": "user-1",
                    "prompt": "A launch",
                    "options": {"videoCount": 2},
                    "storyboards": [{"title": "only one"}],
                }
            )

    def test_result_contains_terminal_metadata(self):
        command = parse_generation_command(
            {
                "schemaVersion": 1,
                "eventId": "event-1",
                "jobId": "job-1",
                "userId": "user-1",
                "prompt": "A video",
            }
        )
        result = result_event(
            command,
            "COMPLETED",
            "FINALIZE",
            100,
            provider_task_id="provider-1",
            result={"provider": "moneyprinterturbo"},
        )
        self.assertEqual(result["type"], "COMPLETED")
        self.assertEqual(result["status"], "DONE")
        self.assertEqual(result["providerTaskId"], "provider-1")
        self.assertEqual(result["progress"], 100)

    def test_validation_failure_is_safe_for_unknown_events(self):
        result = validation_failure_event({}, "INVALID_EVENT", "bad event")
        self.assertEqual(result["jobId"], "unknown")
        self.assertEqual(result["error"]["code"], "INVALID_EVENT")


if __name__ == "__main__":
    unittest.main()
