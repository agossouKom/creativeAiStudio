import base64
import unittest

from app.events import parse_generation_command
from app.provider import GeneratedImages, ImageProviderClient, ImageProviderError


PNG = b"\x89PNG\r\n\x1a\n" + b"pixel-data" * 8


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


def _command(**overrides):
    payload = {
        "schemaVersion": 1,
        "eventId": "event-1",
        "jobId": "job-1",
        "userId": "user-1",
        "prompt": "A neon city at night",
    }
    payload.update(overrides)
    return parse_generation_command(payload)


def _client(session, **kwargs):
    options = {
        "base_url": "https://api.image-provider.test",
        "api_key": "secret",
        "timeout_seconds": 30,
        "max_image_count": 4,
        "default_model": "default-model",
        "session": session,
    }
    options.update(kwargs)
    return ImageProviderClient(
        options.pop("base_url"),
        options.pop("api_key"),
        options.pop("timeout_seconds"),
        options.pop("max_image_count"),
        **options,
    )


class ImageProviderClientTest(unittest.TestCase):
    def test_uses_configured_path_and_auth_header(self):
        session = FakeSession(FakeResponse({"data": [{"b64_json": "Zm9v"}]}))
        client = _client(session, api_path="/sd/v1/generate", auth_scheme="")
        client.generate(_command())

        url, kwargs = session.calls[0]
        self.assertEqual(url, "https://api.image-provider.test/sd/v1/generate")
        self.assertEqual(kwargs["headers"]["Authorization"], "secret")
        self.assertEqual(kwargs["json"]["model"], "default-model")

    def test_uses_default_bearer_scheme(self):
        session = FakeSession(FakeResponse({"data": [{"b64_json": "Zm9v"}]}))
        _client(session).generate(_command())
        self.assertEqual(
            session.calls[0][1]["headers"]["Authorization"], "Bearer secret"
        )

    def test_parses_base64_entries(self):
        encoded = base64.b64encode(PNG).decode()
        session = FakeSession(
            FakeResponse({"data": [{"b64_json": encoded, "revised_prompt": "better"}]})
        )
        generated = _client(session).generate(_command())
        self.assertEqual(generated.model, "default-model")
        self.assertEqual(len(generated.images), 1)
        self.assertEqual(generated.images[0].index, 1)
        self.assertEqual(generated.images[0].base64_data, encoded)
        self.assertIsNone(generated.images[0].url)
        self.assertEqual(generated.images[0].revised_prompt, "better")

    def test_parses_url_entries_in_order(self):
        session = FakeSession(
            FakeResponse(
                {"data": [{"url": "https://cdn.test/a.png"}, {"url": "https://cdn.test/b.png"}]}
            )
        )
        generated = _client(session).generate(_command(options={"count": 2}))
        self.assertEqual([image.url for image in generated.images], [
            "https://cdn.test/a.png",
            "https://cdn.test/b.png",
        ])
        self.assertEqual([image.index for image in generated.images], [1, 2])

    def test_parses_single_image_provider_response(self):
        session = FakeSession(FakeResponse({"image": "Zm9vYmFy"}))
        generated = _client(session).generate(_command())
        self.assertEqual(generated.images[0].base64_data, "Zm9vYmFy")

    def test_rejects_empty_data(self):
        session = FakeSession(FakeResponse({"data": []}))
        with self.assertRaisesRegex(ImageProviderError, "no image"):
            _client(session).generate(_command())

    def test_rejects_entry_without_payload(self):
        session = FakeSession(FakeResponse({"data": [{"revised_prompt": "x"}]}))
        with self.assertRaisesRegex(ImageProviderError, "neither base64 data nor a URL"):
            _client(session).generate(_command())

    def test_rejects_missing_image_field(self):
        session = FakeSession(FakeResponse({"created": 1}))
        with self.assertRaisesRegex(ImageProviderError, "no image data"):
            _client(session).generate(_command())

    def test_rejects_non_json_response(self):
        session = FakeSession(FakeResponse(ValueError("not json")))
        with self.assertRaisesRegex(ImageProviderError, "not JSON"):
            _client(session).generate(_command())

    def test_maps_auth_and_rate_limit_errors(self):
        with self.assertRaises(ImageProviderError) as context:
            _client(FakeSession(FakeResponse({}, 401))).generate(_command())
        self.assertEqual(context.exception.code, "PROVIDER_AUTH_ERROR")
        with self.assertRaises(ImageProviderError) as context:
            _client(FakeSession(FakeResponse({}, 429))).generate(_command())
        self.assertEqual(context.exception.code, "PROVIDER_RATE_LIMITED")
        with self.assertRaises(ImageProviderError) as context:
            _client(FakeSession(FakeResponse({}, 503))).generate(_command())
        self.assertEqual(context.exception.code, "PROVIDER_UNAVAILABLE")
        with self.assertRaises(ImageProviderError) as context:
            _client(FakeSession(FakeResponse({}, 400))).generate(_command())
        self.assertEqual(context.exception.code, "PROVIDER_REQUEST_REJECTED")

    def test_surfaces_provider_error_payload(self):
        session = FakeSession(FakeResponse({"error": {"message": "content filtered"}}))
        with self.assertRaises(ImageProviderError) as context:
            _client(session).generate(_command())
        self.assertEqual(context.exception.code, "PROVIDER_FAILED")
        self.assertIn("content filtered", str(context.exception))

    def test_rejects_count_above_worker_limit(self):
        session = FakeSession(FakeResponse({"data": [{"b64_json": "Zm9v"}]}))
        with self.assertRaises(ImageProviderError) as context:
            _client(session, max_image_count=1).generate(_command(options={"count": 2}))
        self.assertEqual(context.exception.code, "INVALID_OPTIONS")

    def test_result_payload_contains_durable_references(self):
        generated = GeneratedImages(model="default-model", images=())
        payload = ImageProviderClient.result_payload(
            generated, [{"bucket": "b", "objectKey": "results/job-1/1/image-1.png"}]
        )
        self.assertEqual(payload["provider"], "openai-compatible")
        self.assertEqual(payload["model"], "default-model")
        self.assertEqual(payload["outputCount"], 1)
        self.assertFalse(payload["storageRequired"])

    def test_result_payload_requires_stored_outputs(self):
        with self.assertRaises(ValueError):
            ImageProviderClient.result_payload(
                GeneratedImages(model="m", images=()), []
            )


if __name__ == "__main__":
    unittest.main()
