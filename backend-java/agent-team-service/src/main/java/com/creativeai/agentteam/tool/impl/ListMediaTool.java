package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.service.MinioService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ListMediaTool implements AgentTool {

    private final MinioService  minioService;
    private final ObjectMapper  om;

    @Value("${minio.public-url:https://minio.labibpro.com}")
    private String publicUrl;

    @Value("${minio.bucket:pub-images}")
    private String bucket;

    @Override public String getName()        { return "list_media"; }
    @Override public String getDescription() { return "Liste les images/vidéos disponibles dans MinIO pour un préfixe donné. Retourne les URLs publiques utilisables dans post_social."; }
    @Override public String getParametersSchema() {
        return "{\"prefix\":\"string — préfixe de recherche (ex: products/labibpro)\",\"maxResults\":\"integer (défaut: 10)\"}";
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String prefix     = (String) params.getOrDefault("prefix", "");
        int    maxResults = params.containsKey("maxResults")
            ? ((Number) params.get("maxResults")).intValue()
            : 10;

        List<String> keys = minioService.listObjects(prefix, maxResults);
        log.info("[LIST_MEDIA] agent={} prefix='{}' → {} résultats", agentId, prefix, keys.size());

        if (keys.isEmpty()) {
            return "{\"media\":[],\"message\":\"Aucun média trouvé pour le préfixe: " + prefix + "\"}";
        }

        String base = publicUrl.replaceAll("/$", "") + "/" + bucket + "/";
        List<String> urls = keys.stream()
            .filter(k -> k.endsWith(".jpg") || k.endsWith(".jpeg") || k.endsWith(".png") || k.endsWith(".webp") || k.endsWith(".mp4"))
            .map(k -> base + k)
            .toList();

        try {
            return om.writeValueAsString(Map.of(
                "media",   urls,
                "count",   urls.size(),
                "prefix",  prefix,
                "message", urls.isEmpty()
                    ? "Aucun fichier image/vidéo trouvé pour le préfixe: " + prefix
                    : "Utilise une de ces URLs dans post_social (paramètre mediaUrls)"
            ));
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}
