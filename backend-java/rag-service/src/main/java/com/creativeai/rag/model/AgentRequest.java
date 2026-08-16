package com.creativeai.rag.model;

/**
 * Requête générique pour tous les agents IA.
 * content : texte principal (email, CV, sujet marketing, topic slides…)
 * context : informations supplémentaires (poste cible, ton, plateforme…)
 * type    : sous-type d'action (summary | reply | task | urgency | linkedin | seo…)
 */
public record AgentRequest(
        String content,
        String context,
        String type
) {}
