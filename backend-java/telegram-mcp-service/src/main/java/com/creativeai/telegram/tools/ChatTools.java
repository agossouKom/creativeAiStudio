package com.creativeai.telegram.tools;

import com.creativeai.telegram.client.AgentTeamClient;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * Outil MCP pour la communication directe avec un agent IA (RAG, génération, analyse...).
 *
 * Collecte le flux SSE de agent-team-service et retourne la réponse complète
 * pour que le LLM Telegram puisse la reformuler/synthétiser avant envoi.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatTools {

    private final AgentTeamClient client;

    record ChatWithAgentInput(
        @JsonPropertyDescription("UUID de l'agent à qui envoyer le message") String agentId,
        @JsonPropertyDescription("Message ou question à envoyer à l'agent") String message,
        @JsonPropertyDescription("Contexte additionnel à injecter (contenu de document, données brutes…) — optionnel") String context
    ) {}

    @Tool(description = """
        Envoie un message directement à un agent IA spécifique et retourne sa réponse.
        Utilisez cet outil pour : poser des questions à un agent expert, lancer une génération de contenu,
        faire une recherche RAG dans la base de connaissances de l'agent, ou demander une analyse.
        """)
    public String chatWithAgent(ChatWithAgentInput input) {
        log.info("[TOOL:chatWithAgent] agentId={} userId={}", input.agentId(), UserContextHolder.getUserId());
        return client.chatWithAgent(
            UserContextHolder.getUserId(),
            UserContextHolder.getJwtToken(),
            input.agentId(),
            input.message(),
            input.context()
        );
    }
}
