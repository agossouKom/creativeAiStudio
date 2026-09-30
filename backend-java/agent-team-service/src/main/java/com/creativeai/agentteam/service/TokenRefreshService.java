package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Renouvellement automatique des jetons d'accès (cahier des charges : « gestion
 * des tokens »).
 *
 * <p>Passe quotidienne (3h30, configurable) : les comptes qui expirent sous 7
 * jours, ou marqués {@code needsRefresh} (cas TikTok : jeton à 24h), sont
 * renouvelés via le mécanisme du fournisseur — jamais en ré-ouvrant un OAuth :
 *   • Facebook / Instagram : {@code fb_exchange_token} (le long-lived token est
 *     prolongé à 60 jours tant qu'il n'est pas expiré) ;
 *   • TikTok / YouTube / LinkedIn : grant_type=refresh_token.
 * Twitter/X ne délivre pas de refresh token : rien à faire, la connexion est
 * simplement rejouée par l'utilisateur.
 *
 * <p>Un succès met à jour le compte unifié ET les channels connectés qui portent
 * les mêmes credentials : le channel est ce que lit la publication, le compte
 * est ce que supervise l'admin ; les deux restent synchronisés.
 *
 * <p>Toute erreur est laissée à la vue de l'admin (le compte garde son état), et
 * l'exécution continue sur les suivants : un jeton YouTube en échec ne doit pas
 * empêcher de rafraîchir les pages Facebook.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenRefreshService {

    private static final String LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
    private static final String TT_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
    private static final String YT_TOKEN_URL = "https://oauth2.googleapis.com/token";

    private final UserSocialAccountRepository accountRepository;
    private final ChannelRepository channelRepository;
    private final SocialPlatformConfigService configService;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    @Value("${social.token-refresh-buffer-days:7}")
    private int refreshBufferDays;

    /** Remplaçable en test (MockRestServiceServer) : voir TokenRefreshServiceTest. */
    RestTemplate restTemplate = buildRestTemplate();

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        return new RestTemplate(factory);
    }

    @Scheduled(cron = "${social.token-refresh-cron:0 30 3 * * *}")
    public void refreshExpiringTokens() {
        LocalDateTime soon = LocalDateTime.now().plusDays(Math.max(1, refreshBufferDays));
        List<UserSocialAccount> candidates = accountRepository.findRefreshCandidates(soon);
        if (candidates.isEmpty()) {
            log.info("[TOKEN_REFRESH] Passe quotidienne : aucun jeton à renouveler");
            return;
        }
        log.info("[TOKEN_REFRESH] Passe quotidienne : {} jeton(s) à renouveler", candidates.size());
        List<String> errors = new ArrayList<>();
        for (UserSocialAccount account : candidates) {
            try {
                refreshOne(account);
            } catch (Exception e) {
                errors.add(account.getPlatformAccountName() + " (" + account.getPlatform().getId() + ")");
                log.warn("[TOKEN_REFRESH] Échec pour {} : {}", account.getPlatformAccountName(), e.getMessage());
            }
        }
        if (!errors.isEmpty()) {
            log.warn("[TOKEN_REFRESH] {} échec(s) : {}", errors.size(), errors);
        }
    }

    /** Point d'entrée testable : une seule ligne de compte. */
    @Transactional
    public void refreshOne(UserSocialAccount account) throws Exception {
        String platform = account.getPlatform().getId();
        Map<String, Object> creds = decryptCredentials(account.getAccessTokenEnc());

        JsonNode tokens;
        String newRefreshToken = null;
        switch (platform) {
            case "facebook" -> tokens = refreshFacebook(creds);
            case "tiktok" -> {
                TokenOut out = tokenExchange(TT_TOKEN_URL, refreshGrantParams("TIKTOK", creds, "client_key"));
                tokens = out.tokenNode();
                newRefreshToken = out.refreshToken();
            }
            case "youtube" -> {
                TokenOut out = tokenExchange(YT_TOKEN_URL, refreshGrantParams("YOUTUBE", creds, "client_id"));
                tokens = out.tokenNode();
                newRefreshToken = out.refreshToken();
            }
            case "linkedin" -> {
                TokenOut out = tokenExchange(LI_TOKEN_URL, refreshGrantParams("LINKEDIN", creds, "client_id"));
                tokens = out.tokenNode();
                newRefreshToken = out.refreshToken();
            }
            default -> {
                log.info("[TOKEN_REFRESH] Plateforme {} sans refresh automatique, ignorée", platform);
                return;
            }
        }

        applyNewTokens(account, creds, tokens, newRefreshToken);
    }

    // ── Refresh par fournisseur ─────────────────────────────────────────────

    private JsonNode refreshFacebook(Map<String, Object> creds) throws Exception {
        Object userAccessToken = creds.get("userAccessToken");
        if (userAccessToken == null || String.valueOf(userAccessToken).isBlank()) {
            throw new IllegalStateException("Pas de userAccessToken à prolonger");
        }
        var resolved = configService.resolve("FACEBOOK");
        if (resolved.clientId() == null || resolved.clientSecret() == null) {
            throw new IllegalStateException("Identifiants Facebook non configurés");
        }
        String url = configService.graphBaseUrl("FACEBOOK") + "/oauth/access_token"
            + "?grant_type=fb_exchange_token"
            + "&client_id=" + resolved.clientId()
            + "&client_secret=" + resolved.clientSecret()
            + "&fb_exchange_token=" + userAccessToken;
        return parseResponse(restTemplate.getForEntity(url, String.class));
    }

    private MultiValueMap<String, String> refreshGrantParams(String platform,
                                                             Map<String, Object> creds,
                                                             String clientParam) throws Exception {
        String refreshToken = creds.get("refreshToken") == null
            ? null : String.valueOf(creds.get("refreshToken"));
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalStateException("Pas de refresh token pour " + platform);
        }
        var resolved = configService.resolve(platform);
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add(clientParam, resolved.clientId());
        params.add("client_secret", resolved.clientSecret());
        params.add("grant_type", "refresh_token");
        params.add("refresh_token", refreshToken);
        return params;
    }

    private TokenOut tokenExchange(String url, MultiValueMap<String, String> params) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<String> resp = restTemplate.postForEntity(url, new HttpEntity<>(params, headers), String.class);
        JsonNode node = parseResponse(resp);
        return new TokenOut(node, node.path("refresh_token").asText(null));
    }

    // ── Application des nouveaux jetons (compte + channels) ────────────────

    @SuppressWarnings("unchecked")
    private void applyNewTokens(UserSocialAccount account, Map<String, Object> creds,
                                JsonNode tokens, String newRefreshToken) throws Exception {
        String newAccessToken = tokens.path("access_token").asText(null);
        if (newAccessToken == null || newAccessToken.isBlank()) {
            throw new IllegalStateException("Le fournisseur n'a pas renvoyé d'access_token");
        }
        long expiresIn = tokens.path("expires_in").asLong(0);

        // 1. Credentials du compte, réécrits puis re-chiffrés.
        boolean facebook = "facebook".equals(account.getPlatform().getId());
        if (facebook && creds.containsKey("userAccessToken")) {
            // Facebook : fb_exchange_token renvoie le NOUVEAU long-lived token
            // utilisateur ; le accessToken (Page) garde sa propre durée de vie
            // et ne doit pas être écrasé par le jeton utilisateur.
            creds.put("userAccessToken", newAccessToken);
        } else {
            creds.put("accessToken", newAccessToken);
            creds.put("userAccessToken", newAccessToken);
        }
        if (expiresIn > 0) {
            creds.put("expiresIn", expiresIn);
        }
        if (newRefreshToken != null && !newRefreshToken.isBlank()) {
            creds.put("refreshToken", newRefreshToken);
            account.setRefreshTokenEnc(encryptionService.encrypt(newRefreshToken));
        }
        account.setAccessTokenEnc(encryptionService.encrypt(objectMapper.writeValueAsString(creds)));
        account.setTokenExpiresAt(expiresIn > 0 ? LocalDateTime.now().plusSeconds(expiresIn) : null);
        account.setNeedsRefresh(false);
        account.setLastRefreshedAt(LocalDateTime.now());
        account.setLastError(null);
        account.setStatus("CONNECTED");
        accountRepository.save(account);

        // 2. Propagation aux channels connectés du même compte réseau : c'est ce
        //    que la publication lit réellement.
        PlatformType platformType = PlatformType.valueOf(account.getPlatform().getId().toUpperCase());
        List<Channel> channels = channelRepository
            .findByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
                account.getPlatformAccountId(), platformType, ChannelStatus.CONNECTED);
        for (Channel channel : channels) {
            try {
                Map<String, Object> channelCreds = decryptCredentials(channel.getEncryptedCredentials());
                channelCreds.put("accessToken", newAccessToken);
                if (expiresIn > 0) {
                    channelCreds.put("expiresIn", expiresIn);
                }
                if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                    channelCreds.put("refreshToken", newRefreshToken);
                }
                channel.setEncryptedCredentials(encryptionService.encrypt(objectMapper.writeValueAsString(channelCreds)));
                channelRepository.save(channel);
            } catch (Exception e) {
                log.warn("[TOKEN_REFRESH] Channel {} non mis à jour : {}", channel.getId(), e.getMessage());
            }
        }
        log.info("[TOKEN_REFRESH] {} ({}) renouvelé, expire {}", account.getPlatformAccountName(),
            account.getPlatform().getId(),
            account.getTokenExpiresAt() != null ? account.getTokenExpiresAt() : "jamais");
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    /** Le JSON chiffré des credentials est décrypté : accessToken, refreshToken,
     *  userAccessToken, expiresIn… tout y est, jamais en clair en base. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> decryptCredentials(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(encryptionService.decrypt(encrypted), Map.class);
        } catch (Exception e) {
            log.warn("[TOKEN_REFRESH] Credentials illisibles : {}", e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    private JsonNode parseResponse(ResponseEntity<String> resp) throws Exception {
        JsonNode node = objectMapper.readTree(resp.getBody());
        if (node.has("error") || node.has("errors")) {
            throw new IllegalStateException("Erreur du fournisseur : "
                + node.path("error").path("message").asText(
                    node.path("error_description").asText("inconnue")));
        }
        return node;
    }

    private record TokenOut(JsonNode tokenNode, String refreshToken) {}
}