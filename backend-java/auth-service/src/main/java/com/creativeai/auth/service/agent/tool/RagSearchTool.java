package com.creativeai.auth.service.agent.tool;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class RagSearchTool implements AgentTool {

    private final RestTemplate restTemplate;

    @Value("${agent.rag-service-url:http://creativeai-rag:8084}")
    private String ragServiceUrl;

    @Override public String getName()        { return "rag_search"; }
    @Override public String getDescription() {
        return "Cherche des informations dans la base de connaissances RAG. Paramètre: query (string).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        String query = (String) params.get("query");
        if (query == null || query.isBlank()) return "{\"results\": []}";
        try {
            String url = ragServiceUrl + "/rag/search?q=" +
                java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8) + "&topK=3";
            String response = restTemplate.getForObject(url, String.class);
            return response != null ? response : "{\"results\": []}";
        } catch (Exception e) {
            log.warn("RAG search failed (non-critical): {}", e.getMessage());
            return "{\"results\": [], \"note\": \"RAG non disponible\"}";
        }
    }
}
