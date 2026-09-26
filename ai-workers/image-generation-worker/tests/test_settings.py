import unittest
from unittest.mock import patch

from app.settings import Settings


class SettingsTest(unittest.TestCase):
    def test_provider_requires_explicit_configuration(self):
        with patch.dict("os.environ", {}, clear=True):
            settings = Settings.from_env()
        self.assertFalse(settings.provider_configured)
        self.assertFalse(settings.storage_configured)
        self.assertEqual(settings.input_topic, "creativeai.image-generation")
        self.assertEqual(settings.result_topic, "creativeai.image-generation.results")

    def test_provider_accepts_url_and_key(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_PROVIDER_API_KEY": "secret",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.provider_configured)
        self.assertEqual(settings.image_provider_api_path, "/v1/images/generations")
        self.assertEqual(settings.image_provider_auth_header, "Authorization")

    def test_provider_allows_explicit_unauthenticated_mode(self):
        environment = {
            "IMAGE_PROVIDER_URL": "http://comfyui:8188",
            "IMAGE_PROVIDER_ALLOW_UNAUTHENTICATED": "true",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.provider_configured)

    def test_storage_accepts_complete_configuration(self):
        environment = {
            "MINIO_URL": "http://minio:9000",
            "MINIO_ACCESS_KEY": "access",
            "MINIO_SECRET_KEY": "secret",
            "IMAGE_GENERATION_OUTPUT_BUCKET": "image-generation-results",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.storage_configured)
        self.assertEqual(
            settings.image_generation_output_bucket, "image-generation-results"
        )
        self.assertEqual(settings.image_generation_max_output_bytes, 33554432)

    def test_provider_rejects_unsafe_url_shape(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test?key=injected",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_rejects_api_path_with_traversal(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_PROVIDER_API_PATH": "/v1/../../admin",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_rejects_absolute_api_path_url(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_PROVIDER_API_PATH": "https://evil.test/v1/images",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_rejects_injected_auth_header(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_PROVIDER_AUTH_HEADER": "X-Key: injected",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_rejects_injected_model_name(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_MODEL": "model\r\nX-Injected: 1",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_rejects_non_boolean_flag(self):
        environment = {
            "IMAGE_PROVIDER_URL": "https://api.image-provider.test",
            "IMAGE_PROVIDER_SUPPORTS_NEGATIVE_PROMPT": "maybe",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()


if __name__ == "__main__":
    unittest.main()
