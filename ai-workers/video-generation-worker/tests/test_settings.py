import unittest
from unittest.mock import patch

from app.settings import Settings


class SettingsTest(unittest.TestCase):
    def test_provider_requires_explicit_configuration(self):
        with patch.dict("os.environ", {}, clear=True):
            settings = Settings.from_env()
        self.assertEqual(settings.provider, "local")
        self.assertTrue(settings.provider_configured)
        self.assertFalse(settings.storage_configured)

    def test_provider_accepts_url_and_key(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "moneyprinter",
            "MONEYPRINTER_API_URL": "http://moneyprinter:8080",
            "MONEYPRINTER_API_KEY": "secret",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.provider_configured)

    def test_provider_rejects_unknown_selection(self):
        with patch.dict(
            "os.environ", {"VIDEO_GENERATION_PROVIDER": "unknown"}, clear=True
        ):
            with self.assertRaisesRegex(ValueError, "must be local or moneyprinter"):
                Settings.from_env()

    def test_openai_compatible_storyboard_provider_accepts_configuration(self):
        environment = {
            "VIDEO_GENERATION_LLM_PROVIDER": "openai_compatible",
            "VIDEO_GENERATION_LLM_BASE_URL": "https://api.groq.com/openai/v1/",
            "VIDEO_GENERATION_LLM_API_KEY": "test-key",
            "VIDEO_GENERATION_LLM_MODEL": "llama-3.1-8b-instant",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertEqual(settings.storyboard_llm_provider, "openai_compatible")
        self.assertTrue(settings.provider_configured)
        self.assertEqual(
            settings.storyboard_llm_base_url, "https://api.groq.com/openai/v1"
        )

    def test_openai_compatible_storyboard_provider_requires_credentials(self):
        environment = {
            "VIDEO_GENERATION_LLM_PROVIDER": "openai_compatible",
            "VIDEO_GENERATION_LLM_BASE_URL": "https://api.groq.com/openai/v1",
            "VIDEO_GENERATION_LLM_MODEL": "llama-3.1-8b-instant",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertFalse(settings.provider_configured)

    def test_openai_compatible_self_hosted_provider_can_opt_into_no_auth(self):
        environment = {
            "VIDEO_GENERATION_LLM_PROVIDER": "openai_compatible",
            "VIDEO_GENERATION_LLM_BASE_URL": "http://host.docker.internal:8000/v1",
            "VIDEO_GENERATION_LLM_MODEL": "local-model",
            "VIDEO_GENERATION_LLM_ALLOW_UNAUTHENTICATED": "true",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.provider_configured)
        self.assertIsNone(settings.storyboard_llm_api_key)

    def test_groq_and_deepseek_use_existing_api_keys(self):
        for provider, key_name in (("groq", "GROQ_API_KEY"), ("deepseek", "DEEPSEEK_API_KEY")):
            with self.subTest(provider=provider), patch.dict(
                "os.environ",
                {
                    "VIDEO_GENERATION_LLM_PROVIDER": provider,
                    key_name: "test-key",
                    "VIDEO_GENERATION_LLM_MODEL": "test-model",
                },
                clear=True,
            ):
                settings = Settings.from_env()
            self.assertTrue(settings.provider_configured)
            self.assertEqual(settings.storyboard_llm_api_key, "test-key")
            self.assertEqual(settings.storyboard_llm_model, "test-model")

    def test_groq_has_no_hardcoded_model_default(self):
        # Le modèle par défaut de Groq (llama-3.1-8b-instant) a été retiré de
        # l'API : le laisser en dur faisait échouer le job en 404
        # model_not_found, remonté en STORYBOARD_PROVIDER_UNAVAILABLE.
        # Sans VIDEO_GENERATION_LLM_MODEL, le provider est donc incomplet.
        for provider, key_name in (("groq", "GROQ_API_KEY"), ("deepseek", "DEEPSEEK_API_KEY")):
            with self.subTest(provider=provider), patch.dict(
                "os.environ",
                {"VIDEO_GENERATION_LLM_PROVIDER": provider, key_name: "test-key"},
                clear=True,
            ):
                settings = Settings.from_env()
            self.assertIsNone(settings.storyboard_llm_model)
            self.assertFalse(settings.provider_configured)

    def test_storyboard_provider_rejects_unknown_selection(self):
        with patch.dict(
            "os.environ", {"VIDEO_GENERATION_LLM_PROVIDER": "unknown"}, clear=True
        ):
            with self.assertRaisesRegex(
                ValueError, "VIDEO_GENERATION_LLM_PROVIDER must be"
            ):
                Settings.from_env()

    def test_edge_tts_can_be_selected_without_api_credentials(self):
        with patch.dict(
            "os.environ", {"VIDEO_GENERATION_TTS_PROVIDER": "edge"}, clear=True
        ):
            settings = Settings.from_env()
        self.assertEqual(settings.tts_provider, "edge")
        self.assertEqual(settings.edge_tts_binary, "edge-tts")

    def test_tts_provider_rejects_unknown_selection(self):
        with patch.dict(
            "os.environ", {"VIDEO_GENERATION_TTS_PROVIDER": "paid"}, clear=True
        ):
            with self.assertRaisesRegex(
                ValueError, "VIDEO_GENERATION_TTS_PROVIDER must be edge or espeak"
            ):
                Settings.from_env()

    def test_storage_accepts_complete_configuration(self):
        environment = {
            "MINIO_URL": "http://minio:9000",
            "MINIO_ACCESS_KEY": "access",
            "MINIO_SECRET_KEY": "secret",
            "VIDEO_GENERATION_OUTPUT_BUCKET": "video-generation-results",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertTrue(settings.storage_configured)
        self.assertEqual(settings.video_generation_output_bucket, "video-generation-results")

    def test_provider_rejects_unsafe_url_shape(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "moneyprinter",
            "MONEYPRINTER_API_URL": "http://moneyprinter:8080?redirect=https://example.invalid",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaises(ValueError):
                Settings.from_env()

    def test_local_provider_ignores_legacy_moneyprinter_url(self):
        environment = {
            "VIDEO_GENERATION_PROVIDER": "local",
            "MONEYPRINTER_API_URL": "not a valid URL",
        }
        with patch.dict("os.environ", environment, clear=True):
            settings = Settings.from_env()
        self.assertEqual(settings.provider, "local")
        self.assertIsNone(settings.moneyprinter_api_url)


if __name__ == "__main__":
    unittest.main()
