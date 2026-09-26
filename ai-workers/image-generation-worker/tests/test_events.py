import unittest

from app.events import (
    EventValidationError,
    parse_generation_command,
    provider_params,
    result_event,
    validation_failure_event,
)


def _event(**overrides):
    payload = {
        "schemaVersion": 1,
        "eventId": "event-1",
        "jobId": "job-1",
        "userId": "user-1",
        "prompt": "A cinematic portrait of an astronaut",
    }
    payload.update(overrides)
    return payload


class EventContractTest(unittest.TestCase):
    def test_parses_supported_command(self):
        command = parse_generation_command(
            _event(
                options={
                    "size": "1024x1536",
                    "count": 2,
                    "model": "flux-1",
                    "style": "photographic",
                    "quality": "high",
                    "seed": 42,
                    "responseFormat": "url",
                }
            )
        )
        self.assertEqual(command.options.size, "1024x1536")
        self.assertEqual(command.options.count, 2)
        self.assertEqual(command.options.model, "flux-1")
        self.assertEqual(command.options.seed, 42)
        self.assertEqual(command.options.response_format, "url")

    def test_applies_defaults(self):
        command = parse_generation_command(_event())
        self.assertEqual(command.options.size, "1024x1024")
        self.assertEqual(command.options.count, 1)
        self.assertEqual(command.options.response_format, "b64_json")
        self.assertIsNone(command.options.seed)

    def test_rejects_unknown_option(self):
        with self.assertRaises(EventValidationError) as context:
            parse_generation_command(_event(options={"style": "x", "magic": True}))
        self.assertEqual(context.exception.code, "UNSUPPORTED_OPTIONS")

    def test_rejects_assets_until_conditioning_exists(self):
        with self.assertRaises(EventValidationError) as context:
            parse_generation_command(
                _event(assets=[{"bucket": "inputs", "objectKey": "ref.png"}])
            )
        self.assertEqual(context.exception.code, "UNSUPPORTED_ASSETS")

    def test_rejects_invalid_size(self):
        for size in ("1024", "1024*1024", "8x8", "99999x1024", "1024x1024; drop"):
            with self.assertRaises(EventValidationError):
                parse_generation_command(_event(options={"size": size}))

    def test_rejects_out_of_range_count_and_seed(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(_event(options={"count": 0}))
        with self.assertRaises(EventValidationError):
            parse_generation_command(_event(options={"count": 11}))
        with self.assertRaises(EventValidationError):
            parse_generation_command(_event(options={"seed": -1}))

    def test_rejects_unsupported_response_format(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(_event(options={"responseFormat": "binary"}))

    def test_rejects_injected_option_values(self):
        with self.assertRaises(EventValidationError):
            parse_generation_command(_event(options={"style": "x\r\nInjected: 1"}))

    def test_provider_params_include_only_supported_fields(self):
        command = parse_generation_command(
            _event(negativePrompt="blurry", options={"count": 2, "seed": 7})
        )
        payload = provider_params(command, "default-model")
        self.assertEqual(
            payload,
            {
                "prompt": command.prompt,
                "n": 2,
                "size": "1024x1024",
                "response_format": "b64_json",
                "model": "default-model",
                "seed": 7,
            },
        )
        self.assertNotIn("negative_prompt", payload)

    def test_provider_params_include_negative_prompt_when_enabled(self):
        command = parse_generation_command(_event(negativePrompt="blurry"))
        payload = provider_params(
            command, "default-model", include_negative_prompt=True
        )
        self.assertEqual(payload["negative_prompt"], "blurry")

    def test_command_model_overrides_default_model(self):
        command = parse_generation_command(_event(options={"model": "flux-1"}))
        self.assertEqual(provider_params(command, "default-model")["model"], "flux-1")

    def test_result_contains_terminal_metadata(self):
        command = parse_generation_command(_event(executionVersion=4))
        payload = result_event(
            command, "COMPLETED", "FINALIZE", 100, result={"outputs": []}
        )
        self.assertEqual(payload["status"], "DONE")
        self.assertEqual(payload["stage"], "FINALIZE")
        self.assertEqual(payload["jobId"], "job-1")
        self.assertEqual(payload["executionVersion"], 4)
        self.assertTrue(payload["occurredAt"].endswith("Z"))

    def test_validation_failure_is_safe_for_unknown_events(self):
        payload = validation_failure_event(["not", "an", "object"], "INVALID_EVENT", "boom")
        self.assertEqual(payload["jobId"], "unknown")
        self.assertEqual(payload["userId"], "unknown")
        self.assertEqual(payload["stage"], "VALIDATING")
        self.assertEqual(payload["error"]["code"], "INVALID_EVENT")


if __name__ == "__main__":
    unittest.main()
