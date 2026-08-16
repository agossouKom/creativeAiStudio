package com.creativeai.agentteam.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Optional;

/**
 * Client HTTP vers l'auth-service pour récupérer les produits utilisateur.
 * Utilise le token JWT transmis par le contexte de la requête.
 */
@Slf4j
@Component
public class AuthServiceClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public AuthServiceClient(
            WebClient.Builder webClientBuilder,
            @Value("${services.auth-base-url:http://auth-service:8081}") String authBaseUrl,
            ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl(authBaseUrl).build();
        this.objectMapper = objectMapper;
    }

    /**
     * Récupère un produit utilisateur par son code unique.
     * @param code   code unique du produit (ex: "PRD001")
     * @param jwt    token JWT de l'utilisateur (Bearer)
     * @return JsonNode du produit, ou empty si non trouvé
     */
    public Optional<JsonNode> getProductByCode(String code, String jwt) {
        try {
            String body = webClient.get()
                .uri("/api/user/products/by-code/{code}", code)
                .header("Authorization", jwt.startsWith("Bearer ") ? jwt : "Bearer " + jwt)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            if (body == null || body.isBlank()) return Optional.empty();
            return Optional.of(objectMapper.readTree(body));
        } catch (Exception e) {
            log.warn("[AUTH_CLIENT] Produit non trouvé pour code={} : {}", code, e.getMessage());
            return Optional.empty();
        }
    }
}
