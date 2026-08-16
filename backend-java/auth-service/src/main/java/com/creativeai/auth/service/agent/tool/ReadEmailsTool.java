package com.creativeai.auth.service.agent.tool;

import com.creativeai.auth.dto.gmail.GmailEmailDto;
import com.creativeai.auth.service.GmailOAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReadEmailsTool implements AgentTool {

    private final GmailOAuthService gmailService;
    private final ObjectMapper      objectMapper;

    @Override public String getName()        { return "read_emails"; }
    @Override public String getDescription() {
        return "Lis les emails récents depuis Gmail. Paramètres: maxResults (int, défaut 10), labelId (string: INBOX|SENT|UNREAD).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        int    maxResults = params.containsKey("maxResults") ? ((Number) params.get("maxResults")).intValue() : 10;
        String labelId    = (String) params.getOrDefault("labelId", "INBOX");
        try {
            List<GmailEmailDto> emails = gmailService.listEmails(userId, maxResults, labelId, null);
            return objectMapper.writeValueAsString(emails);
        } catch (Exception e) {
            log.warn("read_emails error: {}", e.getMessage());
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
