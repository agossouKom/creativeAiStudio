package com.creativeai.telegram.config;

import com.creativeai.telegram.tools.AgentTools;
import com.creativeai.telegram.tools.ChatTools;
import com.creativeai.telegram.tools.TaskTools;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    /**
     * Unique ToolCallbackProvider regroupant tous les outils MCP.
     * Découvert automatiquement par le MCP server auto-config pour l'exposition HTTP/SSE,
     * et injecté dans le ChatClient pour l'orchestration interne Telegram.
     */
    @Bean
    public ToolCallbackProvider mcpToolCallbackProvider(
            TaskTools taskTools,
            AgentTools agentTools,
            ChatTools chatTools) {
        return MethodToolCallbackProvider.builder()
            .toolObjects(taskTools, agentTools, chatTools)
            .build();
    }

    /**
     * ChatClient utilisé par l'UpdateDispatcher pour répondre aux messages Telegram.
     * Le LLM orchestre les appels d'outils MCP selon la demande de l'utilisateur.
     */
    @Bean
    public ChatClient chatClient(ChatModel model, ToolCallbackProvider mcpToolCallbackProvider) {
        return ChatClient.builder(model)
            .defaultToolCallbacks(mcpToolCallbackProvider)
            .defaultSystem("""
                Tu es l'assistant IA de CreativeAI Studio, accessible via Telegram.
                Tu aides les utilisateurs à piloter leurs agents IA, équipes et tâches.

                Ce que tu peux faire :
                - Créer des tâches (le Scrum Master assigne automatiquement selon les profils d'agents)
                - Consulter et filtrer les tâches existantes
                - Chatter directement avec un agent IA (RAG, génération, analyse…)
                - Lister les agents disponibles et leurs capacités

                Règles IMPORTANTES :
                - Réponds TOUJOURS en français, de manière concise et claire
                - N'EVER demande à l'utilisateur de choisir un agent pour une tâche — l'assignation est AUTOMATIQUE basée sur le type de tâche et les profils agents
                - Pour créer une tâche via le LLM : n'envoie JAMAIS assignedAgentId, laisse-le null
                - Types de tâches disponibles : EMAIL_RESPONSE, EMAIL_CLASSIFICATION, EMAIL_FORWARD, SOCIAL_POST, SOCIAL_REPLY, SOCIAL_ANALYTICS, PROSPECT_SEARCH, PROSPECT_QUALIFY, PROSPECT_OUTREACH, CAMPAIGN_CREATE, CONTENT_GENERATE, SEO_OPTIMIZE, TICKET_HANDLE, TICKET_ESCALATE, FAQ_UPDATE, DOCUMENT_INGEST, DOCUMENT_SEARCH, DOCUMENT_SUMMARIZE, CV_CREATE, CV_ANALYZE, CV_OPTIMIZE, IMAGE_GENERATE, IMAGE_EDIT, REPORT_GENERATE, PRESENTATION_CREATE, SOCIAL_CONTENT, DOCUMENT_PDF, SCHEDULED_TASK, TELEGRAM_TASK, GENERAL
                - Priorités : LOW, MEDIUM, HIGH, URGENT, CRITICAL
                - Pour les réponses longues, utilise le format Markdown Telegram (*gras*, `code`, listes avec -)
                - En cas d'erreur d'un outil, explique simplement ce qui s'est passé sans les détails techniques
                - Si l'utilisateur veut créer une tâche avec un formulaire guidé, indique-lui de taper /task
                """)
            .build();
    }
}
