package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.response.AvailableModelResponse;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Vérifie que la liste de modèles provient bien du fournisseur et qu'un
 * fournisseur injoignable bascule proprement en saisie libre, au lieu de servir
 * un catalogue figé — cause des 404 model_not_found sur Groq.
 */
class LlmModelCatalogServiceTest {

    /** WebClient.Builder qui répond `payload` sur GET {base}/models. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static WebClient.Builder builderReturning(Map<String, Object> payload, boolean fail) {
        WebClient.Builder builder = mock(WebClient.Builder.class);
        WebClient client          = mock(WebClient.class);
        WebClient.RequestHeadersUriSpec request = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.ResponseSpec response        = mock(WebClient.ResponseSpec.class);

        when(builder.build()).thenReturn(client);
        when(client.get()).thenReturn(request);
        // uri() + accept() + header() renvoient tous le même spec : on simule
        // le chaînage fluide du client réel.
        when(request.uri(anyString())).thenReturn((WebClient.RequestHeadersSpec) request);
        when(request.accept(MediaType.APPLICATION_JSON)).thenReturn((WebClient.RequestHeadersSpec) request);
        when(request.header(anyString(), anyString())).thenReturn((WebClient.RequestHeadersSpec) request);
        when(((WebClient.RequestHeadersSpec) request).retrieve()).thenReturn(response);
        when(response.bodyToMono(Map.class))
            .thenReturn(fail ? Mono.error(new IllegalStateException("boom")) : Mono.just(payload));
        return builder;
    }

    @Test
    void listsModelsFromProviderApi() {
        Map<String, Object> payload = Map.of(
            "data", List.of(
                Map.of("id", "qwen/qwen3.8-27b"),
                Map.of("id", "openai/gpt-oss-20b")));

        LlmModelCatalogService svc = new LlmModelCatalogService(
            builderReturning(payload, false), mock(EncryptionService.class), new LlmUrlPolicy());

        AvailableModelResponse res = svc.previewModels(
            LlmType.GROQ, "https://api.groq.com/openai/v1", "gsk-test");

        assertThat(res.source()).isEqualTo("api");
        assertThat(res.models()).containsExactly("qwen/qwen3.8-27b", "openai/gpt-oss-20b");
    }

    @Test
    void acceptsProviderReturningPlainStringList() {
        // Certains fournisseurs/proxys renvoient ["model-a", "model-b"].
        Map<String, Object> payload = Map.of("data", List.of("model-a", "model-b"));

        LlmModelCatalogService svc = new LlmModelCatalogService(
            builderReturning(payload, false), mock(EncryptionService.class), new LlmUrlPolicy());

        AvailableModelResponse res = svc.previewModels(
            LlmType.MISTRAL, "https://api.mistral.ai/v1", "key");

        assertThat(res.source()).isEqualTo("api");
        assertThat(res.models()).containsExactly("model-a", "model-b");
    }

    @Test
    void fallsBackToFreeEntryWhenProviderErrors() {
        LlmModelCatalogService svc = new LlmModelCatalogService(
            builderReturning(Map.of(), true), mock(EncryptionService.class), new LlmUrlPolicy());

        AvailableModelResponse res = svc.previewModels(
            LlmType.GROQ, "https://api.groq.com/openai/v1", "bad-key");

        assertThat(res.source()).isEqualTo("none");
        assertThat(res.models()).isEmpty();
        assertThat(res.message()).contains("manuellement");
    }

    @Test
    void usesProviderKeyFromDatabase() {
        EncryptionService enc = mock(EncryptionService.class);
        when(enc.decrypt("ENCRYPTED")).thenReturn("gsk-from-db");

        LlmProvider provider = LlmProvider.builder()
            .type(LlmType.GROQ)
            .baseUrl("https://api.groq.com/openai/v1")
            .encryptedApiKey("ENCRYPTED")
            .build();

        LlmModelCatalogService svc = new LlmModelCatalogService(
            builderReturning(Map.of("data", List.of(Map.of("id", "qwen/qwen3.8-27b"))), false),
            enc, new LlmUrlPolicy());

        AvailableModelResponse res = svc.listModelsFor(provider);

        assertThat(res.source()).isEqualTo("api");
        assertThat(res.models()).containsExactly("qwen/qwen3.8-27b");
    }
}