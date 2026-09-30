package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.InboxMessageRequest;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.MessageDirection;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import jakarta.mail.internet.MimeMessage;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Dispatche l'envoi de messages vers le bon canal et archive dans l'inbox.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelSenderService {

    private final ChannelRepository    channelRepo;
    private final InboxService         inboxService;
    private final EncryptionService    encryptionService;
    private final JavaMailSender       mailSender;
    private final WebClient.Builder    webClientBuilder;
    private final ObjectMapper         objectMapper;
    private final MinioService         minioService;
    private final MediaSecurityService mediaSecurity;
    private final InstagramService     instagramService;
    private final SocialPlatformConfigService platformConfig;

    /** Racine de l'API Facebook : version gérée par l'administrateur, pas figée ici. */
    private String fbApi() {
        return platformConfig.graphBaseUrl("FACEBOOK");
    }

    @Value("${spring.mail.username}")
    private String mailFrom;

    @Value("${minio.public-url:http://localhost:9400}")
    private String minioPublicUrl;


    public record SendResult(boolean success, String messageId, String error) {}

    // ── Email ─────────────────────────────────────────────────────────────────

    public SendResult sendEmail(String userId, String agentId, String to,
                                String subject, String body, String conversationId) {
        Channel channel = findChannelForAgent(agentId, List.of(ChannelType.GMAIL, ChannelType.EMAIL_SMTP));
        if (channel == null) {
            log.warn("[EMAIL] No email channel configured for agent {}", agentId);
            // Stocker quand même le message sortant dans l'inbox
        }

        log.info("[EMAIL] Sending via SMTP from={} to={} subject='{}'", mailFrom, to, subject);

        // Envoi réel via SMTP (même config que l'OTP du service auth)
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false); // plain text — le LLM génère du texte brut/markdown
            mailSender.send(mime);
            log.info("[EMAIL] Sent OK to={}", to);
        } catch (Exception smtpEx) {
            log.error("[EMAIL] SMTP error: {}", smtpEx.getMessage(), smtpEx);
            return new SendResult(false, null, "SMTP error: " + smtpEx.getMessage());
        }

        // Archive dans l'inbox
        try {
            InboxMessageRequest req = new InboxMessageRequest(
                agentId, null,
                channel != null ? channel.getType() : ChannelType.EMAIL_SMTP,
                MessageDirection.OUTBOUND,
                channel != null ? channel.getAccountId() : null,
                to, subject, body, conversationId, null, null, null, null
            );
            var msg = inboxService.createMessage(userId, req);
            return new SendResult(true, msg.id(), null);
        } catch (Exception e) {
            log.warn("[EMAIL] Archive inbox failed (email was sent): {}", e.getMessage());
            return new SendResult(true, "smtp-sent", null);
        }
    }

    // ── WhatsApp ──────────────────────────────────────────────────────────────

    public SendResult sendWhatsapp(String userId, String agentId, String to,
                                   String body, String conversationId) {
        Channel channel = findChannelForAgent(agentId, List.of(ChannelType.WHATSAPP));

        log.info("[WHATSAPP] Sending from agent={} to={}", agentId, to);

        if (channel != null) {
            try {
                // TODO: appel Meta Cloud API
                // String accessToken = encryptionService.decrypt(channel.getEncryptedCredentials());
                // WhatsAppApiClient.send(accessToken, channel.getAccountId(), to, body);
                log.info("[WHATSAPP] Meta Cloud API call stub — to={} body={}", to,
                        body.length() > 60 ? body.substring(0, 60) + "…" : body);
            } catch (Exception e) {
                log.error("[WHATSAPP] API error: {}", e.getMessage(), e);
                return new SendResult(false, null, "WhatsApp API error: " + e.getMessage());
            }
        } else {
            log.warn("[WHATSAPP] No WhatsApp channel configured for agent {}", agentId);
        }

        try {
            InboxMessageRequest req = new InboxMessageRequest(
                agentId, null, ChannelType.WHATSAPP, MessageDirection.OUTBOUND,
                channel != null ? channel.getAccountId() : null,
                to, null, body, conversationId != null ? conversationId : to, null, null, null, null
            );
            var msg = inboxService.createMessage(userId, req);
            return new SendResult(true, msg.id(), null);
        } catch (Exception e) {
            log.error("[WHATSAPP] Failed to archive: {}", e.getMessage(), e);
            return new SendResult(false, null, e.getMessage());
        }
    }

    // ── Social Media ──────────────────────────────────────────────────────────

    public SendResult postSocial(String userId, String agentId, String platform,
                                 String content, List<String> mediaUrls) {
        String platformUpper = platform != null ? platform.toUpperCase().trim() : "";
        PlatformType platformType = resolvePlatformType(platformUpper);
        Channel channel = findSocialChannelForAgent(agentId, platformType);

        log.info("[SOCIAL] Posting on {} from agent={}", platform, agentId);

        String platformPostId = null; // ID retourné par la plateforme (Facebook postId, Instagram mediaId, etc.)

        if (channel != null) {
            try {
                String credsJson = encryptionService.decrypt(channel.getEncryptedCredentials());
                Map<String, Object> creds = objectMapper.readValue(credsJson, new TypeReference<>() {});
                String accessToken = (String) creds.get("accessToken");
                String pageId = creds.containsKey("pageId")
                        ? (String) creds.get("pageId")
                        : channel.getAccountId();

                switch (platformUpper) {
                    case "FACEBOOK" -> {
                        platformPostId = postToFacebook(pageId, accessToken, content, mediaUrls);
                        log.info("[FACEBOOK] Published postId={}", platformPostId);
                    }
                    case "INSTAGRAM" -> {
                        platformPostId = instagramService.publish(agentId, content, mediaUrls);
                        log.info("[INSTAGRAM] Published mediaId={}", platformPostId);
                    }
                    default -> log.info("[SOCIAL] Stub post on {} — length={}", platform, content.length());
                }
            } catch (WebClientResponseException e) {
                log.error("[SOCIAL] {} API HTTP {}: {}", platform, e.getStatusCode(), e.getResponseBodyAsString());
                return new SendResult(false, null, platform + " API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
            } catch (Exception e) {
                log.error("[SOCIAL] {} API error: {}", platform, e.getMessage(), e);
                return new SendResult(false, null, platform + " API error: " + e.getMessage());
            }
        } else {
            log.warn("[SOCIAL] No {} channel CONNECTED for agent {}", platform, agentId);
            return new SendResult(false, null,
                "Aucun canal " + platform + " connecté pour cet agent");
        }

        // Archiver dans l'inbox (pour tous les canaux, réussis ou en mode stub)
        try {
            ChannelType channelType = resolveChannelType(platformUpper);
            String mediaJson = buildMediaJson(mediaUrls);
            InboxMessageRequest req = new InboxMessageRequest(
                agentId, null, channelType, MessageDirection.OUTBOUND,
                channel != null ? channel.getAccountId() : null,
                platform, "Publication " + platform, content,
                null, mediaJson, null, null, null
            );
            inboxService.createMessage(userId, req);
        } catch (Exception e) {
            log.error("[SOCIAL] Failed to archive: {}", e.getMessage(), e);
        }

        // Retourner l'ID de la plateforme (Facebook postId, Instagram mediaId, etc.)
        return new SendResult(true, platformPostId, null);
    }

    // ── Facebook Comments ─────────────────────────────────────────────────────

    public List<Map<String, Object>> fetchRecentFacebookPosts(String agentId, long sinceUnixSeconds, int limit) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Facebook CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds;
        try {
            String credsJson = encryptionService.decrypt(channel.getEncryptedCredentials());
            creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Credentials Facebook invalides: " + e.getMessage());
        }
        String accessToken = (String) creds.get("accessToken");
        String pageId = creds.containsKey("pageId")
                ? (String) creds.get("pageId")
                : channel.getAccountId();

        WebClient client = webClientBuilder.build();
        String resp;
        try {
            String url = fbApi() + "/" + pageId + "/posts"
                + "?fields=id,message,created_time"
                + "&since=" + sinceUnixSeconds
                + "&limit=" + Math.min(limit, 50)
                + "&access_token=" + accessToken;
            resp = client.get().uri(url).retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            log.error("[FACEBOOK] Posts HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Facebook API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }

        log.debug("[FACEBOOK] Posts since={}: {}", sinceUnixSeconds, resp);
        try {
            Map<?, ?> parsed = objectMapper.readValue(resp, Map.class);
            Object data = parsed.get("data");
            if (data instanceof List<?> list) {
                return list.stream().map(item -> {
                    Map<String, Object> post = new java.util.LinkedHashMap<>();
                    if (item instanceof Map<?, ?> m) {
                        post.put("id", m.get("id"));
                        post.put("message", m.get("message"));
                        post.put("created_time", m.get("created_time"));
                    }
                    return post;
                }).toList();
            }
            return List.of();
        } catch (Exception e) {
            throw new IllegalStateException("Erreur parsing posts Facebook: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> fetchFacebookComments(String agentId, String postId, int limit) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Facebook CONNECTED pour l'agent " + agentId);

        Map<String, Object> creds;
        try {
            String credsJson = encryptionService.decrypt(channel.getEncryptedCredentials());
            creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Credentials Facebook invalides: " + e.getMessage());
        }
        String accessToken = (String) creds.get("accessToken");

        WebClient client = webClientBuilder.build();
        String resp;
        try {
            String url = fbApi() + "/" + postId + "/comments"
                + "?fields=id,message,from,created_time,like_count"
                + "&limit=" + limit
                + "&access_token=" + accessToken;
            resp = client.get().uri(url).retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            log.error("[FACEBOOK] Comments HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalStateException("Facebook API " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }

        log.info("[FACEBOOK] Comments response for post {}: {}", postId, resp);
        try {
            Map<?, ?> parsed = objectMapper.readValue(resp, Map.class);
            Object data = parsed.get("data");
            if (data instanceof List<?> list) {
                return list.stream().map(item -> {
                    Map<String, Object> comment = new java.util.LinkedHashMap<>();
                    if (item instanceof Map<?, ?> m) {
                        comment.put("id", m.get("id"));
                        comment.put("message", m.get("message"));
                        comment.put("created_time", m.get("created_time"));
                        comment.put("like_count", m.get("like_count"));
                        if (m.get("from") instanceof Map<?, ?> from) {
                            comment.put("author_name", from.get("name"));
                            comment.put("author_id", from.get("id"));
                        }
                    }
                    return comment;
                }).toList();
            }
            return List.of();
        } catch (Exception e) {
            throw new IllegalStateException("Erreur parsing réponse Facebook: " + e.getMessage());
        }
    }

    public SendResult replyToFacebookComment(String userId, String agentId,
                                              String commentId, String message) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null) {
            log.warn("[REPLY_FB_COMMENT] No Facebook channel CONNECTED for agent {}", agentId);
            return new SendResult(false, null, "Canal Facebook non configuré pour cet agent");
        }

        try {
            String credsJson = encryptionService.decrypt(channel.getEncryptedCredentials());
            Map<String, Object> creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            String accessToken = (String) creds.get("accessToken");

            // L'API Graph exige l'ID pur du commentaire, pas le format composite postId_commentId.
            // Ex : "122109897531356653_1269739115234273" → on utilise "1269739115234273"
            String pureCommentId = commentId.contains("_")
                    ? commentId.substring(commentId.lastIndexOf('_') + 1)
                    : commentId;

            log.info("[REPLY_FB_COMMENT] commentId original={} → pureCommentId={}", commentId, pureCommentId);

            Map<String, String> body = new HashMap<>();
            body.put("message", message);
            body.put("access_token", accessToken);

            WebClient client = webClientBuilder.build();
            String resp = client.post()
                    .uri(fbApi() + "/" + pureCommentId + "/comments")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[FACEBOOK] Reply to comment {} response: {}", commentId, resp);
            String replyId = extractJsonId(resp);

            try {
                InboxMessageRequest req = new InboxMessageRequest(
                    agentId, null, ChannelType.SOCIAL_MEDIA, MessageDirection.OUTBOUND,
                    channel.getAccountId(),
                    "FACEBOOK_COMMENT/" + commentId, "Réponse commentaire Facebook", message,
                    commentId, null, null, null, null
                );
                var msg = inboxService.createMessage(userId, req);
                return new SendResult(true, msg.id(), null);
            } catch (Exception e) {
                log.warn("[REPLY_FB_COMMENT] Archive inbox failed (reply was sent): {}", e.getMessage());
                return new SendResult(true, replyId, null);
            }
        } catch (WebClientResponseException e) {
            log.error("[REPLY_FB_COMMENT] Facebook API HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return new SendResult(false, null,
                "Facebook API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[REPLY_FB_COMMENT] Error: {}", e.getMessage(), e);
            return new SendResult(false, null, e.getMessage());
        }
    }

    public SendResult commentOnFacebookPost(String userId, String agentId,
                                             String postId, String message) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            return new SendResult(false, null, "Canal Facebook non configuré pour cet agent");
        try {
            String credsJson   = encryptionService.decrypt(channel.getEncryptedCredentials());
            Map<String, Object> creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            String accessToken = (String) creds.get("accessToken");

            Map<String, String> body = new HashMap<>();
            body.put("message", message);
            body.put("access_token", accessToken);

            String resp = webClientBuilder.build()
                    .post()
                    .uri(fbApi() + "/" + postId + "/comments")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[FACEBOOK] Comment on post {} response: {}", postId, resp);
            String commentId = extractJsonId(resp);

            try {
                InboxMessageRequest req = new InboxMessageRequest(
                    agentId, null, ChannelType.SOCIAL_MEDIA, MessageDirection.OUTBOUND,
                    channel.getAccountId(),
                    "FACEBOOK_POST/" + postId, "Commentaire sur post Facebook", message,
                    commentId, null, null, null, null
                );
                var msg = inboxService.createMessage(userId, req);
                return new SendResult(true, msg.id(), null);
            } catch (Exception e) {
                log.warn("[FB_COMMENT_POST] Archive inbox failed (comment was posted): {}", e.getMessage());
                return new SendResult(true, commentId, null);
            }
        } catch (WebClientResponseException e) {
            log.error("[FB_COMMENT_POST] Facebook API HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return new SendResult(false, null,
                "Facebook API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[FB_COMMENT_POST] Error: {}", e.getMessage(), e);
            return new SendResult(false, null, e.getMessage());
        }
    }

    public SendResult deleteFacebookPost(String agentId, String postId) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            return new SendResult(false, null, "Canal Facebook non configuré pour cet agent");
        try {
            String credsJson   = encryptionService.decrypt(channel.getEncryptedCredentials());
            Map<String, Object> creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            String accessToken = (String) creds.get("accessToken");

            String resp = webClientBuilder.build()
                    .delete()
                    .uri(fbApi() + "/" + postId + "?access_token=" + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[FACEBOOK] Delete post {} response: {}", postId, resp);
            return new SendResult(true, postId, null);
        } catch (WebClientResponseException e) {
            log.error("[FB_DELETE_POST] Facebook API HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return new SendResult(false, null, "Facebook API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[FB_DELETE_POST] Error: {}", e.getMessage(), e);
            return new SendResult(false, null, e.getMessage());
        }
    }

    public SendResult editFacebookPost(String agentId, String postId, String newMessage) {
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            return new SendResult(false, null, "Canal Facebook non configuré pour cet agent");
        try {
            String credsJson   = encryptionService.decrypt(channel.getEncryptedCredentials());
            Map<String, Object> creds = objectMapper.readValue(credsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            String accessToken = (String) creds.get("accessToken");

            Map<String, String> body = new HashMap<>();
            body.put("message", newMessage);
            body.put("access_token", accessToken);

            String resp = webClientBuilder.build()
                    .post()
                    .uri(fbApi() + "/" + postId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[FACEBOOK] Edit post {} response: {}", postId, resp);
            return new SendResult(true, postId, null);
        } catch (WebClientResponseException e) {
            log.error("[FB_EDIT_POST] Facebook API HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return new SendResult(false, null, "Facebook API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[FB_EDIT_POST] Error: {}", e.getMessage(), e);
            return new SendResult(false, null, e.getMessage());
        }
    }

    // ── Facebook Graph API ────────────────────────────────────────────────────

    private String postToFacebook(String pageId, String accessToken, String content, List<String> mediaUrls) {
        WebClient client = webClientBuilder.build();

        // Priorité 1 : chemin MinIO explicite (minio://objectKey)
        String minioKey = mediaUrls != null ? mediaUrls.stream()
                .filter(u -> u != null && u.startsWith("minio://"))
                .map(u -> u.substring("minio://".length()))
                .findFirst().orElse(null) : null;

        if (minioKey != null) {
            return postToFacebookWithMinioMedia(client, pageId, accessToken, content, minioKey);
        }

        // Priorité 2 : toute URL MinIO (localhost ou publique via Cloudflare)
        // Facebook ne peut pas fiablement télécharger depuis MinIO → on télécharge localement et upload en binaire
        String minioUrl = mediaUrls != null ? mediaUrls.stream()
                .filter(u -> u != null && isMinioUrl(u))
                .findFirst().orElse(null) : null;

        if (minioUrl != null) {
            String path = extractMinioPath(minioUrl); // "bucket/object/key"
            int slash = path.indexOf('/');
            if (slash > 0) {
                String bucketName = path.substring(0, slash);
                String objectKey  = path.substring(slash + 1);
                log.info("[FACEBOOK] URL MinIO détectée → upload binaire bucket={} key={}", bucketName, objectKey);
                return postToFacebookWithCrossBucketMedia(client, pageId, accessToken, content, bucketName, objectKey);
            }
        }

        // Priorité 3 : URL publique HTTP(S) externe (accessible par Facebook)
        String httpUrl = mediaUrls != null ? mediaUrls.stream()
                .filter(u -> u != null && (u.startsWith("https://") || u.startsWith("http://")))
                .findFirst().orElse(null) : null;

        if (httpUrl != null) {
            Map<String, String> body = new HashMap<>();
            body.put("url", httpUrl);
            body.put("caption", content);
            body.put("access_token", accessToken);
            String resp = client.post()
                    .uri(fbApi() + "/" + pageId + "/photos")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[FACEBOOK] Photo (URL externe) response: {}", resp);
            return extractJsonId(resp);
        }

        // Pas de média : post texte simple
        Map<String, String> body = new HashMap<>();
        body.put("message", content);
        body.put("access_token", accessToken);
        String resp = client.post()
                .uri(fbApi() + "/" + pageId + "/feed")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        log.info("[FACEBOOK] Feed response: {}", resp);
        return extractJsonId(resp);
    }

    private String postToFacebookWithCrossBucketMedia(WebClient client, String pageId,
                                                       String accessToken, String content,
                                                       String bucketName, String objectKey) {
        mediaSecurity.validateObjectKey(objectKey);
        log.info("[FACEBOOK] Téléchargement cross-bucket MinIO bucket={} key={}", bucketName, objectKey);
        byte[] bytes = minioService.downloadBytesFromBucket(bucketName, objectKey);
        mediaSecurity.validateSize(bytes, objectKey);
        mediaSecurity.validateMagicBytes(bytes, objectKey);
        String contentType = mediaSecurity.contentType(objectKey);
        boolean isVideo    = mediaSecurity.isVideo(objectKey);
        String filename    = objectKey.contains("/") ? objectKey.substring(objectKey.lastIndexOf('/') + 1) : objectKey;

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("access_token", accessToken);
        builder.part(isVideo ? "description" : "caption", content);
        builder.part("source", new org.springframework.core.io.ByteArrayResource(bytes) {
            @Override public String getFilename() { return filename; }
        }).contentType(org.springframework.http.MediaType.parseMediaType(contentType));

        String endpoint = isVideo
                ? fbApi() + "/" + pageId + "/videos"
                : fbApi() + "/" + pageId + "/photos";

        String resp = client.post()
                .uri(endpoint)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(org.springframework.web.reactive.function.BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block();
        log.info("[FACEBOOK] Cross-bucket media upload response: {}", resp);
        return extractJsonId(resp);
    }

    private String postToFacebookWithMinioMedia(WebClient client, String pageId,
                                                 String accessToken, String content, String objectKey) {
        // ── Sécurité ──────────────────────────────────────────────────────────
        mediaSecurity.validateObjectKey(objectKey);

        log.info("[FACEBOOK] Downloading MinIO object: {}", objectKey);
        byte[] bytes = minioService.downloadBytes(objectKey);

        mediaSecurity.validateSize(bytes, objectKey);
        mediaSecurity.validateMagicBytes(bytes, objectKey);

        String contentType = mediaSecurity.contentType(objectKey);
        boolean isVideo    = mediaSecurity.isVideo(objectKey);

        log.info("[FACEBOOK] Uploading {} bytes ({}) from MinIO to Facebook", bytes.length, contentType);

        // ── Upload multipart vers Facebook ────────────────────────────────────
        String filename = objectKey.contains("/")
                ? objectKey.substring(objectKey.lastIndexOf('/') + 1)
                : objectKey;

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("access_token", accessToken);
        builder.part(isVideo ? "description" : "caption", content);
        builder.part("source", new ByteArrayResource(bytes) {
            @Override public String getFilename() { return filename; }
        }).contentType(org.springframework.http.MediaType.parseMediaType(contentType));

        String endpoint = isVideo
                ? fbApi() + "/" + pageId + "/videos"
                : fbApi() + "/" + pageId + "/photos";

        String resp = client.post()
                .uri(endpoint)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.info("[FACEBOOK] MinIO media upload response: {}", resp);
        return extractJsonId(resp);
    }

    /** Retourne true si l'URL pointe vers MinIO (localhost ou Cloudflare). */
    private boolean isMinioUrl(String url) {
        if (url == null) return false;
        String base = minioPublicUrl.replaceAll("/$", "");
        return url.startsWith("http://localhost:9400/")
            || url.startsWith("http://localhost:9000/")
            || url.startsWith("http://minio:")
            || (!base.isBlank() && url.startsWith(base + "/"));
    }

    /** Extrait "bucket/objectKey" depuis une URL MinIO (localhost ou Cloudflare). */
    private String extractMinioPath(String url) {
        String base = minioPublicUrl.replaceAll("/$", "");
        if (!base.isBlank() && url.startsWith(base + "/"))
            return url.substring(base.length() + 1);
        // localhost:9400/bucket/key ou localhost:9000/bucket/key
        return url.replaceFirst("http://localhost:\\d+/", "")
                  .replaceFirst("http://minio:\\d+/", "");
    }

    private String extractJsonId(String jsonResp) {
        if (jsonResp == null) return null;
        try {
            Map<?, ?> m = objectMapper.readValue(jsonResp, Map.class);
            Object id = m.get("id");
            return id != null ? String.valueOf(id) : jsonResp;
        } catch (Exception e) {
            return jsonResp;
        }
    }

    // ── Facebook Token Renewal ─────────────────────────────────────────────────

    public Map<String, Object> renewFacebookToken(String agentId, String appId, String appSecret, String shortToken) {
        WebClient client = webClientBuilder.build();

        // Étape 1 : échange token court → token longue durée utilisateur
        String exchangeUrl = "https://graph.facebook.com/oauth/access_token"
            + "?grant_type=fb_exchange_token"
            + "&client_id=" + appId
            + "&client_secret=" + appSecret
            + "&fb_exchange_token=" + shortToken;
        String exchangeResp;
        try {
            exchangeResp = client.get().uri(exchangeUrl).retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            throw new IllegalStateException("Échange token échoué: " + e.getResponseBodyAsString());
        }
        Map<String, Object> exchangeData;
        try {
            exchangeData = objectMapper.readValue(exchangeResp, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Réponse échange invalide: " + exchangeResp);
        }
        if (exchangeData.containsKey("error"))
            throw new IllegalStateException("Erreur Facebook: " + exchangeData.get("error"));
        String longUserToken = (String) exchangeData.get("access_token");
        Object expiresIn    = exchangeData.get("expires_in");

        // Étape 2 : récupérer le Page Access Token via /me/accounts
        String accountsUrl = fbApi() + "/me/accounts?access_token=" + longUserToken;
        String accountsResp;
        try {
            accountsResp = client.get().uri(accountsUrl).retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            throw new IllegalStateException("Récupération pages échouée: " + e.getResponseBodyAsString());
        }
        Map<String, Object> accountsData;
        try {
            accountsData = objectMapper.readValue(accountsResp, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Réponse /me/accounts invalide");
        }
        if (accountsData.containsKey("error"))
            throw new IllegalStateException("Erreur /me/accounts: " + accountsData.get("error"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pages = (List<Map<String, Object>>) accountsData.get("data");
        if (pages == null || pages.isEmpty())
            throw new IllegalStateException("Aucune Page Facebook trouvée pour ce compte.");

        // Trouver le canal connecté pour cet agent et matcher la page
        Channel channel = findSocialChannelForAgent(agentId, PlatformType.FACEBOOK);
        if (channel == null)
            throw new IllegalStateException("Aucun canal Facebook CONNECTED pour cet agent.");

        String pageId    = channel.getAccountId();
        Map<String, Object> matchedPage = pages.stream()
            .filter(p -> pageId != null && pageId.equals(p.get("id")))
            .findFirst()
            .orElse(pages.get(0)); // fallback sur la première page si une seule

        String pageToken  = (String) matchedPage.get("access_token");
        String pageName   = (String) matchedPage.get("name");
        String resolvedId = (String) matchedPage.get("id");

        // Étape 3 : chiffrer et sauvegarder
        String credsJson = "{\"accessToken\":\"" + pageToken + "\",\"pageId\":\"" + resolvedId + "\"}";
        try {
            String encrypted = encryptionService.encrypt(credsJson);
            channel.setEncryptedCredentials(encrypted);
            channel.setTokenExpiresAt(null); // Page token sans expiration fixe
            channel.setAccountId(resolvedId);
            channel.setAccountName(pageName);
            channelRepo.save(channel);
            log.info("[FB_RENEW] Token renouvelé canal={} page={} ({})", channel.getId(), pageName, resolvedId);
        } catch (Exception e) {
            throw new IllegalStateException("Échec sauvegarde token: " + e.getMessage());
        }

        return Map.of(
            "success",   true,
            "pageName",  pageName,
            "pageId",    resolvedId,
            "expiresIn", expiresIn != null ? expiresIn : "permanent"
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Channel findChannelForAgent(String agentId, List<ChannelType> types) {
        return channelRepo
            .findByAgentIdAndDeletedFalse(agentId)
            .stream()
            .filter(c -> types.contains(c.getType()) && c.getStatus() == ChannelStatus.CONNECTED)
            .findFirst()
            .orElse(null);
    }

    private Channel findSocialChannelForAgent(String agentId, PlatformType platformType) {
        return channelRepo
            .findByAgentIdAndDeletedFalse(agentId)
            .stream()
            .filter(c -> c.getType() == ChannelType.SOCIAL_MEDIA
                      && c.getStatus() == ChannelStatus.CONNECTED
                      && (platformType == null || platformType == c.getPlatformType()))
            .findFirst()
            .orElse(null);
    }

    private ChannelType resolveChannelType(String platform) {
        if (platform == null) return ChannelType.SOCIAL_MEDIA;
        return switch (platform.toUpperCase().trim()) {
            case "WHATSAPP"  -> ChannelType.WHATSAPP;
            case "TELEGRAM"  -> ChannelType.TELEGRAM;
            case "SLACK"     -> ChannelType.SLACK;
            default          -> ChannelType.SOCIAL_MEDIA;
        };
    }

    private PlatformType resolvePlatformType(String platform) {
        if (platform == null || platform.isBlank()) return null;
        try {
            return PlatformType.valueOf(platform);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String buildMediaJson(List<String> mediaUrls) {
        if (mediaUrls == null || mediaUrls.isEmpty()) return null;
        return "{\"mediaUrls\":" + mediaUrls.stream()
                .map(u -> "\"" + u + "\"")
                .collect(java.util.stream.Collectors.joining(",", "[", "]")) + "}";
    }
}
