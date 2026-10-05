package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.response.AvailableModelResponse;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Interroge l'endpoint {@code /models} du fournisseur pour lister les modèles
 * réellement disponibles.
 *
 * <p>Objectif : ne plus maintenir de catalogue de modèles dans le frontend.
 * Les fournisseurs retirent des modèles (Groq a supprimé
 * {@code llama-3.3-70b-versatile} et {@code llama-3.1-8b-instant}), ce qui
 * transformait une liste figée en piège : l'utilisateur choisissait un modèle
 * supprimé et chaque appel LLM échouait en 404 {@code model_not_found}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LlmModelCatalogService {

    private final WebClient.Builder webClientBuilder;
    private final EncryptionService  encryptionService;
    private final LlmUrlPolicy       urlPolicy;

    @Value("${agent.groq-base-url}")   private String groqBaseUrl;
    @Value("${agent.openai-base-url}") private String openAiBaseUrl;
    @Value("${agent.ollama-base-url}") private String ollamaBaseUrl;
    @Value("${agent.anthropic-base-url:https://api.anthropic.com/v1}") private String anthropicBaseUrl;
    @Value("${DEEPSEEK_API_KEY:}")    private String deepseekApiKey;
    @Value("${GROQ_API_KEY:}")        private String groqApiKey;

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    /** Modèles proposés quand le fournisseur n'expose pas de catalogue. */
    private static final Map<String, List<String>> FALLBACK_MODELS = Map.of(
        "ANTHROPIC", List.of(),
        "GEMINI",    List.of(),
        "MISTRAL",   List.of(),
        "COHERE",    List.of(),
        "TOGETHER_AI", List.of()
    );

    /**
     * Liste les modèles d'un provider déjà enregistré.
     *
     * @param provider provider de l'utilisateur (contient la clé chiffrée)
     */
    public AvailableModelResponse listModelsFor(LlmProvider provider) {
        String label = provider.getType().name();
        try {
            String key = resolveKey(provider);
            List<String> models = fetchModels(baseUrl(provider), key);
            if (!models.isEmpty()) {
                return AvailableModelResponse.fromApi(label, models);
            }
        } catch (WebClientResponseException e) {
            log.warn("[LLM-CATALOG] {} : /models a répondu {} — liste locale utilisée", label, e.getStatusCode());
        } catch (RuntimeException e) {
            log.warn("[LLM-CATALOG] {} : /models inaccessible ({}) — liste locale utilisée",
                label, e.getMessage());
        }
        List<String> fallback = FALLBACK_MODELS.getOrDefault(label, List.of());
        if (!fallback.isEmpty()) {
            return AvailableModelResponse.fromConfig(label, fallback,
                "Ce fournisseur n'expose pas de catalogue : saisissez l'identifiant du modèle manuellement.");
        }
        return AvailableModelResponse.none(label,
            "Catalogue indisponible : saisissez l'identifiant du modèle manuellement.");
    }

    /**
     * Variante pour la saisie en cours (avant enregistrement du provider) :
     * la clé est fournie en clair et n'est jamais persistée.
     */
    public AvailableModelResponse previewModels(LlmType type, String baseUrl, String plainKey) {
        String label = type.name();
        // Contrôle SSRF avant l'appel : c'est le chemin le plus exposé, la base
        // venant directement du formulaire et la clé allant vers cette adresse.
        String requested = urlPolicy.validate(type, baseUrl);
        try {
            String base = (requested == null) ? defaultBaseUrl(type) : requested;
            List<String> models = fetchModels(base, plainKey);
            if (!models.isEmpty()) {
                return AvailableModelResponse.fromApi(label, models);
            }
        } catch (WebClientResponseException e) {
            log.warn("[LLM-CATALOG] {} (aperçu) : /models a répondu {}", label, e.getStatusCode());
        } catch (RuntimeException e) {
            log.warn("[LLM-CATALOG] {} (aperçu) : /models inaccessible ({})", label, e.getMessage());
        }
        return AvailableModelResponse.none(label,
            "Impossible de récupérer le catalogue : saisissez l'identifiant du modèle manuellement.");
    }

    private String baseUrl(LlmProvider p) {
        String base = p.getBaseUrl();
        return (base == null || base.isBlank()) ? defaultBaseUrl(p.getType()) : stripTrailingSlash(base.trim());
    }

    /**
     * Clé en clair pour l'appel : celle du provider si elle est déchiffrable,
     * sinon la variable d'environnement du fournisseur. L'appel à /models
     * échouera proprement si aucune n'est disponible.
     */
    private String resolveKey(LlmProvider provider) {
        if (provider.getEncryptedApiKey() != null && !provider.getEncryptedApiKey().isBlank()) {
            try {
                return encryptionService.decrypt(provider.getEncryptedApiKey());
            } catch (RuntimeException e) {
                log.warn("[LLM-CATALOG] Clé en base illisible pour {} — variable d'env utilisée",
                    provider.getType());
            }
        }
        return switch (provider.getType()) {
            case GROQ     -> groqApiKey;
            case DEEPSEEK -> deepseekApiKey;
            case OLLAMA   -> "";   // Ollama n'exige pas de clé
            default       -> "";
        };
    }

    private String defaultBaseUrl(LlmType type) {
        return switch (type) {
            case GROQ      -> stripTrailingSlash(groqBaseUrl);
            case OLLAMA    -> stripTrailingSlash(ollamaBaseUrl);
            case ANTHROPIC -> stripTrailingSlash(anthropicBaseUrl);
            case MISTRAL   -> "https://api.mistral.ai/v1";
            case GEMINI    -> "https://generativelanguage.googleapis.com/v1beta/openai";
            case COHERE    -> "https://api.cohere.ai/v1";
            case TOGETHER_AI -> "https://api.together.xyz/v1";
            case DEEPSEEK  -> "https://api.deepseek.com";
            case OPENAI    -> stripTrailingSlash(openAiBaseUrl);
        };
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    /**
     * Appelle {@code GET {base}/models}. L'ordre renvoyé par Groq et OpenAI
     * va du plus récent au plus ancien : on le conserve tel quel.
     */
    @SuppressWarnings("unchecked")
    private List<String> fetchModels(String baseUrl, String apiKey) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return List.of();
        }
        WebClient.RequestHeadersSpec<?> spec = webClientBuilder.build().get()
            .uri(baseUrl + "/models")
            .accept(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isBlank()) {
            spec = spec.header("Authorization", "Bearer " + apiKey);
        }
        Map<String, Object> body = spec.retrieve()
            .bodyToMono(Map.class)
            .timeout(TIMEOUT)
            .block();

        List<?> list = extractList(body);
        if (list == null || list.isEmpty()) {
            return List.of();
        }

        List<String> ids = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof String s && !s.isBlank()) {
                ids.add(s.trim());
            } else if (item instanceof Map<?, ?> m) {
                Object id = m.get("id");
                if (id instanceof String s && !s.isBlank()) {
                    ids.add(s.trim());
                }
            }
        }
        return ids.stream().distinct().toList();
    }

    /**
     * Extrait la liste de modèles de la réponse. Le format n'est pas
     * standardisé : OpenAI/Groq renvoient {@code {"data":[{"id":…}]}}, d'autres
     * comme Mistral ou Ollama renvoient une liste d'objets ou de chaînes.
     */
    private static List<?> extractList(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object data = body.get("data");
        if (data instanceof List<?> l) {
            return l;
        }
        Object models = body.get("models");
        if (models instanceof List<?> l) {
            return l;
        }
        // Ollama : {"models":[{"name":…}]}
        return null;
    }
}