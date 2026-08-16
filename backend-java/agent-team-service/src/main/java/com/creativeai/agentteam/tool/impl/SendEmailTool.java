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
public class SendEmailTool implements AgentTool {

    private final ChannelSenderService channelSender;
    private final ObjectMapper         objectMapper;

    @Override public String getName() { return "send_email"; }

    @Override
    public String getDescription() {
        return "Envoie un email via SMTP à UN destinataire. "
             + "Pour plusieurs destinataires, appeler cet outil UNE FOIS PAR ADRESSE. "
             + "Archive automatiquement le message dans l'inbox. "
             + "Retourne success=true et messageId si l'envoi réussit, success=false et error sinon.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "to":             "string (obligatoire) — adresse email du destinataire (une seule adresse par appel)",
              "subject":        "string (obligatoire) — objet de l'email",
              "body":           "string (obligatoire) — corps de l'email (texte brut ou Markdown)",
              "conversationId": "string (optionnel)  — ID de conversation pour regrouper les échanges"
            }
            IMPORTANT : pour envoyer à plusieurs personnes, appeler send_email une fois par adresse.
            """;
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String to      = (String) params.get("to");
        String subject = (String) params.get("subject");
        String body    = (String) params.get("body");

        if (to == null || to.isBlank())      return "{\"error\":\"Paramètre 'to' obligatoire\"}";
        if (subject == null || subject.isBlank()) return "{\"error\":\"Paramètre 'subject' obligatoire\"}";
        if (body == null || body.isBlank())  return "{\"error\":\"Paramètre 'body' obligatoire\"}";

        String conversationId = (String) params.get("conversationId");

        log.info("[SEND_EMAIL] agent={} to={} subject='{}'", agentId, to, subject);

        ChannelSenderService.SendResult result =
                channelSender.sendEmail(userId, agentId, to, subject, body, conversationId);

        try {
            if (result.success()) {
                return objectMapper.writeValueAsString(Map.of(
                    "success",   true,
                    "messageId", result.messageId(),
                    "to",        to,
                    "subject",   subject,
                    "message",   "Email envoyé et archivé dans l'inbox avec succès."
                ));
            } else {
                return objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "error",   result.error() != null ? result.error() : "Erreur inconnue"
                ));
            }
        } catch (Exception e) {
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}
