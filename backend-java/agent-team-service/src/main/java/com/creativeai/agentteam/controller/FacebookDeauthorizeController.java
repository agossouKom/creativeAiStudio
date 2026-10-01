package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Webhook de désautorisation Facebook (« deauthorize callback »), exigence
 * obligatoire du RGPD : quand un utilisateur supprime l'application dans ses
 * réglages Meta, Meta POSTe un {@code signed_request} ici et nos jetons doivent
 * être révoqués sous 24h.
 *
 * <p>Authentification : le {@code signed_request} est signé HMAC-SHA256 avec le
 * secret applicatif Facebook — rien d'autre ne fait foi. On compare la
 * signature en temps constant pour ne pas se transformer en oracle de timing,
 * puis on désactive tous les comptes Facebook/Instagram de cet utilisateur
 * (soft-delete + jetons purgés), ainsi que les canaux agents qui en portent une
 * copie dans leurs credentials.
 *
 * <p>Endpoint <b>public</b> par nécessité (Meta ne s'authentifie pas) : la
 * sécurité, comme pour le callback OAuth, tient tout entière dans la signature
 * de la requête.
 */
@RestController
@RequestMapping("/api/oauth/social/facebook")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "OAuth Social", description = "Webhooks Facebook")
public class FacebookDeauthorizeController {

    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    private final SocialPlatformConfigService configService;
    private final UserSocialAccountRepository accountRepository;
    private final ChannelRepository channelRepository;
    private final ObjectMapper objectMapper;

    @Operation(
        summary = "Webhook de désautorisation Facebook (deauthorize callback)",
        description = "Meta POSTe ici un signed_request lors de la suppression de "
            + "l'application par l'utilisateur. Validé par signature HMAC-SHA256, "
            + "puis les jetons Facebook/Instagram de l'utilisateur sont révoqués "
            + "(purgés, comptes soft-deletés). Retourne 200 une fois la signature "
            + "acceptée."
    )
    @PostMapping(value = "/deauthorize", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<?> deauthorize(@RequestBody String rawBody) {
        // Meta envoie signed_request=xxxx.yyyy en body url-encodé.
        String signedRequest = extractSignedRequest(rawBody);
        if (signedRequest == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "signed_request manquant"));
        }

        // 1. Décomposition signature + payload (le payload est la partie AVANT le
        //    point, conformément à la spec Meta : sig = HMAC(payload)).
        String[] parts = signedRequest.split("\\.");
        if (parts.length != 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "signed_request invalide"));
        }
        String payloadB64 = parts[0];
        String receivedSig = parts[1];

        String appSecret = configService.resolve("FACEBOOK").clientSecret();
        if (appSecret == null || appSecret.isBlank()) {
            log.error("[DEAUTH] Aucun secret Facebook configuré, refus du webhook");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Application Facebook non configurée"));
        }

        try {
            byte[] expected = hmacSha256(payloadB64.getBytes(StandardCharsets.UTF_8), appSecret);
            if (!MessageDigest.isEqual(expected, base64UrlDecode(receivedSig))) {
                log.warn("[DEAUTH] Signature invalide — webhook rejeté");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Signature invalide"));
            }

            // 2. Payload vérifié : extraire le user_id app-scoped.
            String payloadJson = new String(B64URL.decode(payloadB64), StandardCharsets.UTF_8);
            JsonNode payload = objectMapper.readTree(payloadJson);
            String algorithm = payload.path("algorithm").asText("");
            boolean reseauAujourdhui = "HMAC-SHA256".equals(algorithm) || "HMACSHA256".equals(algorithm);
            if (!reseauAujourdhui) {
                log.warn("[DEAUTH] Algorithme inattendu : {}", algorithm);
                return ResponseEntity.badRequest().body(Map.of("error", "Algorithme inconnu"));
            }

            String metaUserId = payload.path("user_id").asText(null);
            if (metaUserId == null || metaUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "user_id absent"));
            }

            // 3. Révoquer : Meta signale la suppression de l'app pour le compte
            //    Facebook, dont Instagram hérite. La plateforme « facebook »
            //    porte les deux entrées.
            int revoked = revokeAccounts("facebook", metaUserId);
            log.info("[DEAUTH] Révocation Meta user {} : {} compte(s) Facebook/Instagram purgé(s)",
                metaUserId, revoked);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payload illisible"));
        } catch (Exception e) {
            log.error("[DEAUTH] Erreur de traitement du webhook", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Traitement impossible"));
        }
    }

    private int revokeAccounts(String platformId, String metaUserId) {
        java.util.List<UserSocialAccount> accounts = accountRepository.findByMetaUserId(platformId, metaUserId);
        for (UserSocialAccount account : accounts) {
            account.setDeleted(true);
            account.setStatus("DISCONNECTED");
            account.setNeedsRefresh(false);
            account.setAccessTokenEnc(null);
            account.setRefreshTokenEnc(null);
            account.setTokenExpiresAt(null);
            account.setLastError("Désautorisé via Meta (deauthorize callback)");
            account.setLastRefreshedAt(LocalDateTime.now());
            accountRepository.save(account);
            // Les canaux rattachés portent une COPIE des mêmes credentials dans
            // encrypted_credentials : sans ce purge, le jeton révoqué reste
            // lisible et l'échec n'apparaît qu'au moment de publier, sous forme
            // d'erreur API inexpliquée pour l'utilisateur.
            revokeChannels(platformId, account.getPlatformAccountId());
        }
        return accounts.size();
    }

    /**
     * Purge les credentials de tous les canaux d'un compte réseau et les passe en
     * DISCONNECTED, quel que soit leur état : un canal EXPIRED ou déjà
     * déconnecté conserve sinon un jeton mort.
     */
    private void revokeChannels(String platformId, String platformAccountId) {
        if (platformAccountId == null || platformAccountId.isBlank()) return;
        PlatformType platformType;
        try {
            platformType = PlatformType.valueOf(platformId.toUpperCase());
        } catch (IllegalArgumentException e) {
            return;
        }
        List<Channel> channels = channelRepository
            .findByAccountIdAndPlatformTypeAndDeletedFalse(platformAccountId, platformType);
        for (Channel channel : channels) {
            channel.setEncryptedCredentials(null);
            channel.setStatus(ChannelStatus.DISCONNECTED);
            channel.setTokenExpiresAt(null);
            channel.setSocialAccount(null);
            channelRepository.save(channel);
        }
        if (!channels.isEmpty()) {
            log.info("[DEAUTH] {} canal(s) {} déconnecté(s) et purgés", channels.size(), platformType);
        }
    }

    private static byte[] hmacSha256(byte[] data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] base64UrlDecode(String value) {
        return B64URL.decode(value);
    }

    /** http://php2curl.urlencoded signed_request=... → la valeur seule. */
    private String extractSignedRequest(String body) {
        if (body == null || body.isBlank()) return null;
        String[] pairs = body.split("&");
        for (String pair : pairs) {
            if (pair.startsWith("signed_request=")) {
                return pair.substring("signed_request=".length());
            }
        }
        return null;
    }
}