package com.creativeai.auth.service.agent.tool;

import com.creativeai.auth.dto.gmail.GmailSendRequest;
import com.creativeai.auth.service.GmailOAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SendEmailTool implements AgentTool {

    private final GmailOAuthService gmailService;

    @Override public String getName()        { return "send_email"; }
    @Override public String getDescription() {
        return "Envoie un email via Gmail. Paramètres: to (string), subject (string), body (string), threadId (string, optionnel).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        String to       = (String) params.get("to");
        String subject  = (String) params.get("subject");
        String body     = (String) params.get("body");
        String threadId = (String) params.getOrDefault("threadId", null);

        if (to == null || subject == null || body == null)
            return "{\"error\": \"to, subject et body sont requis\"}";

        try {
            gmailService.sendEmail(userId, new GmailSendRequest(to, subject, body, threadId));
            return "{\"success\": true, \"message\": \"Email envoyé à " + to + "\"}";
        } catch (Exception e) {
            log.warn("send_email error: {}", e.getMessage());
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
