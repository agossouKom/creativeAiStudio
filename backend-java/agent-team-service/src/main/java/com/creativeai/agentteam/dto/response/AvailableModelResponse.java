package com.creativeai.agentteam.dto.response;

import java.util.List;

/**
 * Modèles exposés par un provider LLM, tels que listés par son endpoint
 * {@code /models}. Sert à alimenter le sélecteur de modèle de l'espace de
 * travail sans maintenir de catalogue figé dans le frontend : les modèles
 * retirés par le fournisseur (Groq a notamment supprimé llama-3.3-70b et
 * llama-3.1-8b-instant) disparaissent automatiquement de la liste.
 *
 * @param provider    clé du provider (GROQ, OPENAI, …)
 * @param source      "api" si la liste vient du fournisseur, "provider-config"
 *                    si le fournisseur n'expose pas de catalogue et que les
 *                    modèles viennent de la configuration locale, "none" si
 *                    aucune liste n'est disponible (saisie libre)
 * @param models      identifiants de modèles, du plus recently ajouté au plus ancien
 * @param message     message lisible en cas de source "none"
 */
public record AvailableModelResponse(
    String provider,
    String source,
    List<String> models,
    String message
) {
    public static AvailableModelResponse fromApi(String provider, List<String> models) {
        return new AvailableModelResponse(provider, "api", models, null);
    }

    public static AvailableModelResponse fromConfig(String provider, List<String> models, String message) {
        return new AvailableModelResponse(provider, "provider-config", models, message);
    }

    public static AvailableModelResponse none(String provider, String message) {
        return new AvailableModelResponse(provider, "none", List.of(), message);
    }
}