package com.creativeai.auth.service.agent.tool;

import com.creativeai.auth.service.GmailOAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class GetEmailBodyTool implements AgentTool {

    private final GmailOAuthService gmailService;
    private final ObjectMapper      objectMapper;

    @Override public String getName()        { return "get_email_body"; }
    @Override public String getDescription() {
        return "Récupère le contenu complet d'un email. Paramètre requis: messageId (string).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        String messageId = (String) params.get("messageId");
        if (messageId == null || messageId.isBlank())
            return "{\"error\": \"messageId requis\"}";
        try {
            var email = gmailService.getEmailDetail(userId, messageId);
            return objectMapper.writeValueAsString(email);
        } catch (Exception e) {
            log.warn("get_email_body error: {}", e.getMessage());
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
