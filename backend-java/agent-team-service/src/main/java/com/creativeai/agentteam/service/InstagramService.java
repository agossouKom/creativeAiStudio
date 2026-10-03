package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;

/**
 * Service Instagram Graph API.
 *
 * Credentials stockées dans le canal (JSON chiffré) :
 *   { "accessToken": "EAA...", "igUserId": "17841400..." }
 *
 * igUserId = ID du compte Instagram Business, obtenu via :
 *   GET /{page-id}?fields=instagram_business_account&access_token=...
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InstagramService {

    private final ChannelRepository    channelRepo;
    private final EncryptionService    encryptionService;
    private final ObjectMapper         objectMapper;
    private final WebClient.Builder    webClientBuilder;
    private final SocialPlatformConfigService platformConfig;

    /** Racine de l'API Instagram : version gérée par l'administrateur, pas figée ici. */
    private String igApi() {
        return platformConfig.graphBaseUrl("INSTAGRAM");
    }

    @Value("${app.public-url:http://localhost:8480}")
    private String appPublicUrl;

    @Value("${minio.public-url:http://localhost:9400}")
    private String minioPublicUrl;

    // ── Résolution canal ────────────────────────────────────────────────────────

    public Channel findChannel(String agentId) {
        return channelRepo.findAll().stream()
            .filter(c -> !c.isDeleted()
                && c.getType()         == ChannelType.SOCIAL_MEDIA
                && c.getPlatformType() == PlatformType.INSTAGRAM
                && c.getStatus()       == ChannelStatus.CONNECTED
                && c.getAgent() != null
                && c.getAgent().getId().equals(agentId))
            .findFirst().orElse(null);
    }

    public List<Channel> findAllConnectedChannels() {
        return channelRepo.findAll().stream()
            .filter(c -> !c.isDeleted()
                && c.getType()         == ChannelType.SOCIAL_MEDIA
                && c.getPlatformType() == PlatformType.INSTAGRAM
                && c.getStatus()       == ChannelStatus.CONNECTED
                && c.getAgent() != null)
            .toList();
    }

    public Map<String, Object> getCredentials(Channel channel) {
        try {
            // igUserId vient du canal Instagram
            String igJson = encryptionService.decrypt(channel.getEncryptedCredentials());
            Map<String, Object> creds = new java.util.HashMap<>(
                objectMapper.readValue(igJson, new TypeReference<>() {}));

            // accessToken : toujours pris depuis le canal Facebook du même agent
            // (token permanent, partagé Facebook+Instagram sur la même Page Meta)
            String agentId = channel.getAgent().getId();
            channelRepo.findByAgentIdAndDeletedFalse(agentId).stream()
                .filter(c -> c.getType()         == ChannelType.SOCIAL_MEDIA
                          && c.getPlatformType() == PlatformType.FACEBOOK
                          && c.getStatus()       == ChannelStatus.CONNECTED
                          && !c.isDeleted())
                .findFirst()
                .ifPresent(fbChannel -> {
                    try {
                        String fbJson  = encryptionService.decrypt(fbChannel.getEncryptedCredentials());
                        Map<String, Object> fbCreds = objectMapper.readValue(fbJson, new TypeReference<>() {});
                        String fbToken = (String) fbCreds.get("accessToken");
                        if (fbToken != null && !fbToken.isBlank()) {
                            creds.put("accessToken", fbToken);
                            log.info("[INSTAGRAM] accessToken hérité du canal Facebook (agent={})", agentId);
                        }
                    } catch (Exception ex) {
                        log.warn("[INSTAGRAM] Impossible de lire token Facebook pour agent={}: {}", agentId, ex.getMessage());
                    }
                });

            return creds;
        } catch (Exception e) {
            throw new IllegalStateException("Credentials Instagram invalides: " + e.getMessage());
        }
    }

    // ── Publication ─────────────────────────────────────────────────────────────

    /**
     * Publie un post sur Instagram (image ou texte-only).
     * Retourne l'ID du média publié.
     *
     * Note : Instagram exige que l'URL d'image soit publiquement accessible.
     * Les URLs MinIO localhost sont remplacées par l'URL publique de l'app.
     */
    public String publish(String agentId, String caption, List<String> mediaUrls) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");
        String igUserId    = (String) creds.get("igUserId");

        if (igUserId == null || igUserId.isBlank())
            throw new IllegalStateException("igUserId manquant dans les credentials Instagram");

        String imageUrl = resolvePublicImageUrl(mediaUrls);

        WebClient client = webClientBuilder.build();

        // Étape 1 : créer le container média
        Map<String, Object> containerParams = new LinkedHashMap<>();
        containerParams.put("caption", caption);
        containerParams.put("access_token", accessToken);

        if (imageUrl != null) {
            // L'extension est lue sur le chemin seul : une URL signée se termine par
            // "?X-Amz-...", sinon une vidéo serait envoyée comme une image.
            String path = imageUrl.split("[?#]", 2)[0].toLowerCase();
            if (path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm")) {
                containerParams.put("media_type", "REELS");
                containerParams.put("video_url", imageUrl);
                containerParams.put("share_to_feed", true);
            } else {
                containerParams.put("image_url", imageUrl);
            }
        } else {
            // L'API Instagram n'a pas de publication texte seule : /media exige
            // image_url, video_url (REELS) ou children (CAROUSEL). Envoyer
            // media_type=IMAGE sans image_url ne fait que repousser l'erreur de
            // Meta en (#100) illisible pour l'utilisateur — mieux vaut un refus
            // explicite ici, avant de créer quoi que ce soit.
            throw new IllegalStateException(
                "Instagram n'accepte pas une publication texte seule : ajoutez au moins une image "
                    + "(mediaUrls) ou une vidéo Reel. Facebook, lui, publie du texte sans média.");
        }

        String containerResp;
        try {
            containerResp = client.post()
                .uri(igApi() + "/" + igUserId + "/media")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(containerParams)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] Erreur création container HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }

        String creationId = extractId(containerResp);
        if (creationId == null)
            throw new IllegalStateException("Instagram: container_id non reçu — réponse: " + containerResp);

        log.info("[INSTAGRAM] Container créé creationId={}", creationId);

        // Attendre que le container soit prêt — obligatoire pour images ET vidéos
        if (imageUrl != null) {
            waitForContainerReady(client, creationId, accessToken, 60);
        }

        // Étape 2 : publier le container
        Map<String, Object> publishParams = new LinkedHashMap<>();
        publishParams.put("creation_id", creationId);
        publishParams.put("access_token", accessToken);

        String publishResp;
        try {
            publishResp = client.post()
                .uri(igApi() + "/" + igUserId + "/media_publish")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(publishParams)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] Erreur publication HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram publish API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }

        String mediaId = extractId(publishResp);
        log.info("[INSTAGRAM] Publié mediaId={}", mediaId);
        return mediaId;
    }

    // ── Médias récents ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> fetchRecentMedia(String agentId, int limit) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");
        String igUserId    = (String) creds.get("igUserId");

        String url = igApi() + "/" + igUserId + "/media"
            + "?fields=id,caption,media_type,timestamp,media_url,thumbnail_url,permalink"
            + "&limit=" + Math.min(limit, 50)
            + "&access_token=" + accessToken;

        try {
            String resp = webClientBuilder.build().get().uri(url).retrieve().bodyToMono(String.class).block();
            JsonNode root = objectMapper.readTree(resp);
            JsonNode data = root.path("data");
            List<Map<String, Object>> result = new ArrayList<>();
            if (data.isArray()) {
                for (JsonNode item : data) {
                    Map<String, Object> media = new LinkedHashMap<>();
                    media.put("id",            item.path("id").asText(null));
                    media.put("caption",       item.path("caption").asText(null));
                    media.put("media_type",    item.path("media_type").asText(null));
                    media.put("timestamp",     item.path("timestamp").asText(null));
                    media.put("media_url",     item.path("media_url").asText(null));
                    media.put("thumbnail_url", item.path("thumbnail_url").asText(null));
                    media.put("permalink",     item.path("permalink").asText(null));
                    result.add(media);
                }
            }
            return result;
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] fetchRecentMedia HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new IllegalStateException("Erreur parsing médias Instagram: " + e.getMessage());
        }
    }

    // ── Commentaires ────────────────────────────────────────────────────────────

    public List<Map<String, Object>> fetchComments(String agentId, String mediaId, int limit) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");

        // Pas de sous-champ replies{} : les accolades sont interprétées comme templates URI par WebClient
        String url = igApi() + "/" + mediaId + "/comments"
            + "?fields=id,text,username,timestamp,like_count"
            + "&limit=" + Math.min(limit, 100)
            + "&access_token=" + accessToken;

        try {
            String resp = webClientBuilder.build().get().uri(url).retrieve().bodyToMono(String.class).block();
            log.debug("[INSTAGRAM] Comments response mediaId={}: {}", mediaId, resp);
            JsonNode root = objectMapper.readTree(resp);
            JsonNode data = root.path("data");
            List<Map<String, Object>> result = new ArrayList<>();
            if (data.isArray()) {
                for (JsonNode item : data) {
                    Map<String, Object> comment = new LinkedHashMap<>();
                    comment.put("id",          item.path("id").asText(null));
                    comment.put("text",        item.path("text").asText(null));
                    comment.put("username",    item.path("username").asText(null));
                    comment.put("timestamp",   item.path("timestamp").asText(null));
                    comment.put("like_count",  item.path("like_count").asInt(0));
                    result.add(comment);
                }
            }
            return result;
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] fetchComments HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new IllegalStateException("Erreur parsing commentaires Instagram: " + e.getMessage());
        }
    }

    // ── Répondre à un commentaire ───────────────────────────────────────────────

    public String replyToComment(String agentId, String commentId, String message) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);

        try {
            String resp = webClientBuilder.build()
                .post()
                .uri(igApi() + "/" + commentId + "/replies")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            log.info("[INSTAGRAM] Reply to comment {} response: {}", commentId, resp);
            return extractId(resp);
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] replyToComment HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }
    }

    // ── Commenter un média ──────────────────────────────────────────────────────

    public String commentOnMedia(String agentId, String mediaId, String message) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);

        try {
            String resp = webClientBuilder.build()
                .post()
                .uri(igApi() + "/" + mediaId + "/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            log.info("[INSTAGRAM] Comment on media {} response: {}", mediaId, resp);
            return extractId(resp);
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] commentOnMedia HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Instagram API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }
    }

    // ── Supprimer un média ──────────────────────────────────────────────────────

    public boolean deleteMedia(String agentId, String mediaId) {
        Channel channel = findChannel(agentId);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Instagram CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds = getCredentials(channel);
        String accessToken = (String) creds.get("accessToken");

        try {
            String resp = webClientBuilder.build()
                .delete()
                .uri(igApi() + "/" + mediaId + "?access_token=" + accessToken)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            log.info("[INSTAGRAM] Delete media {} response: {}", mediaId, resp);
            return true;
        } catch (WebClientResponseException e) {
            log.error("[INSTAGRAM] deleteMedia HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return false;
        }
    }

    // ── Auto-fetch igUserId depuis un Page Access Token ─────────────────────────

    /**
     * Retourne l'Instagram Business Account ID associé à une page Facebook.
     * Utilise GET /{page-id}?fields=instagram_business_account&access_token=...
     */
    public String fetchIgUserIdFromPage(String pageId, String accessToken) {
        String url = igApi() + "/" + pageId
            + "?fields=instagram_business_account"
            + "&access_token=" + accessToken;
        try {
            String resp = webClientBuilder.build().get().uri(url).retrieve().bodyToMono(String.class).block();
            JsonNode root = objectMapper.readTree(resp);
            String igId = root.path("instagram_business_account").path("id").asText(null);
            if (igId == null || igId.isBlank())
                throw new IllegalStateException("Cette page Facebook n'a pas de compte Instagram Business associé");
            return igId;
        } catch (WebClientResponseException e) {
            throw new IllegalStateException("Facebook API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new IllegalStateException("Erreur récupération igUserId: " + e.getMessage());
        }
    }

    // ── Utilitaires ─────────────────────────────────────────────────────────────

    private String resolvePublicImageUrl(List<String> mediaUrls) {
        if (mediaUrls == null || mediaUrls.isEmpty()) return null;
        for (String url : mediaUrls) {
            if (url == null || url.isBlank()) continue;
            // Remplacer URL MinIO localhost par URL publique de l'app
            if (url.startsWith("http://localhost:9400/") || url.startsWith("http://localhost:9000/")) {
                String path = url.replaceFirst("http://localhost:\\d+/", "");
                String publicUrl = minioPublicUrl.replaceAll("/$", "") + "/" + path;
                log.info("[INSTAGRAM] MinIO URL → public URL: {} → {}", url, publicUrl);
                return publicUrl;
            }
            return url;
        }
        return null;
    }

    private void waitForContainerReady(WebClient client, String containerId, String accessToken, int maxSeconds) {
        for (int i = 0; i < maxSeconds; i++) {
            try {
                Thread.sleep(1000);
                String resp = client.get()
                    .uri(igApi() + "/" + containerId + "?fields=status_code&access_token=" + accessToken)
                    .retrieve().bodyToMono(String.class).block();
                JsonNode node = objectMapper.readTree(resp);
                String status = node.path("status_code").asText("");
                if ("FINISHED".equals(status)) {
                    log.info("[INSTAGRAM] Container {} prêt après {}s", containerId, i + 1);
                    return;
                }
                if ("ERROR".equals(status)) {
                    throw new IllegalStateException("Instagram container en erreur: " + resp);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.warn("[INSTAGRAM] Attente container {}: {}", containerId, e.getMessage());
            }
        }
        log.warn("[INSTAGRAM] Container {} toujours pas prêt après {}s — on publie quand même", containerId, maxSeconds);
    }

    private String extractId(String json) {
        if (json == null) return null;
        try {
            JsonNode node = objectMapper.readTree(json);
            return node.path("id").asText(null);
        } catch (Exception e) {
            return null;
        }
    }
}
