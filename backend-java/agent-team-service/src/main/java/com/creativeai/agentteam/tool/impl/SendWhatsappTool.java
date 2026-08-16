package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SendWhatsappTool implements AgentTool {

    private final ChannelSenderService channelSender;
    private final ObjectMapper         objectMapper;

    @Override public String getName() { return "send_whatsapp"; }

    @Override
    public String getDescription() {
        return "Envoie un message WhatsApp via le canal WhatsApp Business configuré pour cet agent. "
             + "Archive automatiquement le message dans l'inbox. "
             + "Retourne un messageId si l'envoi réussit.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "to":             "string (obligatoire) — numéro de téléphone international (ex: +33612345678)",
              "body":           "string (obligatoire) — texte du message (max 4096 caractères)",
              "conversationId": "string (optionnel)  — ID de conversation pour regrouper les échanges"
            }
            """;
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String to   = (String) params.get("to");
        String body = (String) params.get("body");

        if (to == null || to.isBlank())   return "{\"error\":\"Paramètre 'to' obligatoire (numéro international)\"}";
        if (body == null || body.isBlank()) return "{\"error\":\"Paramètre 'body' obligatoire\"}";

        String conversationId = (String) params.get("conversationId");

        log.info("[SEND_WHATSAPP] agent={} to={}", agentId, to);

        ChannelSenderService.SendResult result =
                channelSender.sendWhatsapp(userId, agentId, to, body, conversationId);

        try {
            if (result.success()) {
                return objectMapper.writeValueAsString(Map.of(
                    "success",   true,
                    "messageId", result.messageId(),
                    "to",        to,
                    "message",   "Message WhatsApp envoyé et archivé dans l'inbox."
                ));
            } else {
                return objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "error",   result.error() != null ? result.error() : "Canal WhatsApp non configuré pour cet agent"
                ));
            }
        } catch (Exception e) {
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}
