package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.ChannelRequest;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * OAuthSocialController — OAuth 2.0 wizard pour connexion guidée des réseaux sociaux.
 *
 * Flow complet sans copier-coller de tokens :
 *   1. GET  /api/oauth/social/{platform}/authorize?agentId=xxx  → URL OAuth à ouvrir
 *      (AUTHENTIFIÉ : l'agent doit appartenir à l'utilisateur, l'état est lié à lui)
 *   2. L'utilisateur clique, s'authentifie sur la plateforme
 *   3. La plateforme redirige vers GET /api/oauth/social/{platform}/callback?code=...&state=...
 *      (public par nécessité : c'est le `state` opaque à usage unique qui fait foi)
 *   4. Le backend échange le code, chiffre les tokens, crée/met à jour le Channel
 *   5. Redirection vers le frontend (page de succès ou d'erreur)
 *
 * Plateformes supportées :
 *   - FACEBOOK / INSTAGRAM : Meta OAuth (Graph API v19)
 *   - LINKEDIN             : LinkedIn OAuth 2.0
 *   - TWITTER_X            : Twitter OAuth 2.0 PKCE (S256)
 *   - TIKTOK               : TikTok OAuth 2.0
 *   - YOUTUBE              : Google OAuth 2.0 (YouTube Data API v3)
 */
@RestController
@RequestMapping("/api/oauth/social")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "OAuth Social", description = "Connexion guidée OAuth des réseaux sociaux — aucun copier-coller requis")
public class OAuthSocialController {

    private final ChannelService channelService;
    private final ChannelRepository channelRepo;
    private final AgentRepository agentRepo;
    private final EncryptionService encryptionService;
    private final OAuthStateStore stateStore;
    private final ObjectMapper objectMapper;

    // ── Config ───────────────────────────────────────────────────────────────

    @Value("${app.public-url:http://localhost:8480}")
    private String publicUrl;

    @Value("${app.frontend-url:http://localhost:4400}")
    private String frontendUrl;

    // Facebook / Instagram
    @Value("${oauth.facebook.app-id:}")
    private String fbAppId;
    @Value("${oauth.facebook.app-secret:}")
    private String fbAppSecret;

    // LinkedIn
    @Value("${oauth.linkedin.client-id:}")
    private String linkedinClientId;
    @Value("${oauth.linkedin.client-secret:}")
    private String linkedinClientSecret;

    // Twitter/X
    @Value("${oauth.twitter.client-id:}")
    private String twitterClientId;
    @Value("${oauth.twitter.client-secret:}")
    private String twitterClientSecret;

    // TikTok
    @Value("${oauth.tiktok.client-key:}")
    private String tiktokClientKey;
    @Value("${oauth.tiktok.client-secret:}")
    private String tiktokClientSecret;

    // YouTube (Google)
    @Value("${GMAIL_CLIENT_ID:}")
    private String googleClientId;
    @Value("${GMAIL_CLIENT_SECRET:}")
    private String googleClientSecret;

    private final RestTemplate restTemplate = buildRestTemplate();

    /**
     * Les échanges de tokens partent vers des API tierces : sans timeout, une
     * plateforme qui ne répond pas immobilise les threads du pool Tomcat et
     * l'endpoint `/callback` finit par répondre 503 au navigateur de l'utilisateur.
     */
    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        return new RestTemplate(factory);
    }

    // ── Constantes ───────────────────────────────────────────────────────────

    private static final String FB_AUTH_URL   = "https://www.facebook.com/v19.0/dialog/oauth";
    private static final String FB_TOKEN_URL  = "https://graph.facebook.com/v19.0/oauth/access_token";
    private static final String FB_PAGES_URL  = "https://graph.facebook.com/v19.0/me/accounts";

    private static final String LI_AUTH_URL   = "https://www.linkedin.com/oauth/v2/authorization";
    private static final String LI_TOKEN_URL  = "https://www.linkedin.com/oauth/v2/accessToken";
    private static final String LI_ME_URL     = "https://api.linkedin.com/v2/me";

    private static final String TW_AUTH_URL   = "https://twitter.com/i/oauth2/authorize";
    private static final String TW_TOKEN_URL  = "https://api.twitter.com/2/oauth2/token";
    private static final String TW_ME_URL     = "https://api.twitter.com/2/users/me";

    private static final String TT_AUTH_URL   = "https://www.tiktok.com/v2/auth/authorize/";
    private static final String TT_TOKEN_URL  = "https://open.tiktokapis.com/v2/oauth/token/";

    private static final String YT_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String YT_TOKEN_URL  = "https://oauth2.googleapis.com/token";
    private static final String YT_ME_URL     = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

    private static final Set<String> SUPPORTED_PLATFORMS =
        Set.of("FACEBOOK", "INSTAGRAM", "LINKEDIN", "TWITTER_X", "TIKTOK", "YOUTUBE");

    // ═════════════════════════════════════════════════════════════════════════
    //  STEP 1 — Générer l'URL d'autorisation OAuth (AUTHENTIFIÉ)
    // ═════════════════════════════════════════════════════════════════════════

    @Operation(
        summary = "Obtenir l'URL d'autorisation OAuth",
        description = """
            Retourne l'URL à ouvrir dans le navigateur pour authoriser la connexion.
            L'utilisateur n'a rien à copier-coller : cliquer sur le lien suffit.

            Requiert un JWT valide et un `agentId` appartenant à l'utilisateur.

            **Plateformes** : FACEBOOK, INSTAGRAM, LINKEDIN, TWITTER_X, TIKTOK, YOUTUBE
            """
    )
    @GetMapping("/{platform}/authorize")
    public ResponseEntity<Map<String, Object>> getAuthUrl(
            Authentication authentication,
            @PathVariable String platform,
            @RequestParam(required = false) String agentId,
            @RequestParam(required = false) String channelId) {

        // 1. Authentification obligatoire — plus de repli sur l'owner de l'agent.
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Authentification requise pour démarrer une connexion OAuth"));
        }
        if (agentId == null || agentId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "agentId est obligatoire"));
        }

        // 2. Plateforme supportée (validée avant de consommer quoi que ce soit).
        String platformUpper;
        try {
            platformUpper = requireSupportedPlatform(platform);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        // 3. L'agent doit appartenir à l'utilisateur authentifié : sans cette
        //    vérification, un utilisateur authentifié pourrait démarrer un flow sur
        //    l'agent d'un autre et y rattacher un canal.
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, userId).orElse(null);
        if (agent == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Agent introuvable ou non autorisé pour cet utilisateur"));
        }

        // 4. Si un canal est fourni, il doit appartenir à cet agent.
        String effectiveChannelId = (channelId != null && !channelId.isBlank()) ? channelId : null;
        if (effectiveChannelId != null
            && channelRepo.findByIdAndAgentIdAndDeletedFalse(effectiveChannelId, agentId).isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Canal introuvable ou non autorisé pour cet agent"));
        }

        // 5. Émission d'un état opaque, imprévisible, à usage unique, borné dans le
        //    temps et lié à (utilisateur, agent, canal, plateforme).
        OAuthStateStore.Issued issued;
        try {
            issued = stateStore.issue(userId, agentId, effectiveChannelId, platformUpper);
        } catch (IllegalStateException e) {
            log.warn("[OAUTH] Émission d'état refusée : {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", "Trop de connexions OAuth en cours, réessayez dans un instant"));
        }

        String state = issued.state();
        String callbackUri = publicUrl + "/api/oauth/social/" + platform.toLowerCase() + "/callback";

        String authUrl;
        try {
            authUrl = switch (platformUpper) {
                case "FACEBOOK", "INSTAGRAM" -> buildFbAuthUrl(callbackUri, state, platformUpper);
                case "LINKEDIN"   -> buildLinkedinAuthUrl(callbackUri, state);
                case "TWITTER_X"  -> buildTwitterAuthUrl(callbackUri, state, issued.codeVerifier());
                case "TIKTOK"     -> buildTiktokAuthUrl(callbackUri, state);
                case "YOUTUBE"    -> buildYoutubeAuthUrl(callbackUri, state);
                default -> throw new IllegalArgumentException("Plateforme non supportée : " + platform);
            };
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        // Vérifier si les clés sont configurées
        boolean configured = isPlatformConfigured(platformUpper);

        return ResponseEntity.ok(Map.of(
            "platform",    platformUpper,
            "authUrl",     authUrl,
            "state",       state,
            "configured",  configured,
            "expiresInSeconds", stateStore.ttl().toSeconds(),
            "message",     configured
                ? "Cliquez sur authUrl pour connecter votre compte"
                : "Clés OAuth non configurées pour " + platformUpper + " — voir CONFIGURATION.md"
        ));
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  STEP 2 — Callback OAuth (la plateforme redirige ici après autorisation)
    //
    //  Public par nécessité (redirection navigateur). La sécurité tient au `state` :
    //  opaque, à usage unique, expiré et lié à l'utilisateur initiateur.
    // ═════════════════════════════════════════════════════════════════════════

    // ── Facebook / Instagram ─────────────────────────────────────────────────

    @GetMapping("/facebook/callback")
    public ResponseEntity<Void> facebookCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "FACEBOOK");
    }

    @GetMapping("/instagram/callback")
    public ResponseEntity<Void> instagramCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "INSTAGRAM");
    }

    // ── LinkedIn ─────────────────────────────────────────────────────────────

    @GetMapping("/linkedin/callback")
    public ResponseEntity<Void> linkedinCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "LINKEDIN");
    }

    // ── Twitter/X ────────────────────────────────────────────────────────────

    @GetMapping("/twitter_x/callback")
    public ResponseEntity<Void> twitterCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "TWITTER_X");
    }

    // ── TikTok ───────────────────────────────────────────────────────────────

    @GetMapping("/tiktok/callback")
    public ResponseEntity<Void> tiktokCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "TIKTOK");
    }

    // ── YouTube ──────────────────────────────────────────────────────────────

    @GetMapping("/youtube/callback")
    public ResponseEntity<Void> youtubeCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        return handleOAuthCallback(code, state, error, "YOUTUBE");
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Statut de connexion d'une plateforme pour un agent
    // ═════════════════════════════════════════════════════════════════════════

    @Operation(summary = "Lister les plateformes sociales connectées pour un agent")
    @GetMapping("/status/{agentId}")
    public ResponseEntity<List<Map<String, Object>>> platformStatus(
            Authentication authentication,
            @PathVariable String agentId) {

        // Même règle d'ownership que /authorize : sinon un utilisateur authentifié
        // pourrait énumérer les comptes connectés sur l'agent d'un autre.
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(List.of(Map.of("error", "Authentification requise")));
        }
        if (agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, userId).isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(List.of(Map.of("error", "Agent introuvable ou non autorisé")));
        }

        List<Channel> channels = channelRepo.findByAgentIdAndDeletedFalse(agentId)
            .stream()
            .filter(c -> c.getType() == ChannelType.SOCIAL_MEDIA)
            .toList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (PlatformType platform : PlatformType.values()) {
            Channel ch = channels.stream()
                .filter(c -> c.getPlatformType() == platform)
                .findFirst().orElse(null);
            result.add(Map.of(
                "platform",     platform.name(),
                "connected",    ch != null && ch.getStatus() == ChannelStatus.CONNECTED,
                "channelId",    ch != null ? ch.getId() : "",
                "accountName",  ch != null && ch.getAccountName() != null ? ch.getAccountName() : "",
                "configured",   isPlatformConfigured(platform.name()),
                "lastSync",     ch != null && ch.getLastSyncAt() != null ? ch.getLastSyncAt().toString() : ""
            ));
        }
        return ResponseEntity.ok(result);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Helpers — Construction des URLs OAuth
    // ═════════════════════════════════════════════════════════════════════════

    private String requireSupportedPlatform(String platform) {
        if (platform == null || platform.isBlank()) {
            throw new IllegalArgumentException("Plateforme manquante");
        }
        String normalized = platform.toUpperCase();
        if (!SUPPORTED_PLATFORMS.contains(normalized)) {
            throw new IllegalArgumentException("Plateforme non supportée : " + platform);
        }
        return normalized;
    }

    /**
     * Identifiant de l'appelant, ou {@code null} s'il n'est pas authentifié.
     *
     * <p>Attention : {@code @AuthenticationPrincipal String} ne suffit pas. Le filtre
     * d'anonymat de Spring Security installe un {@code AnonymousAuthenticationToken}
     * dont le principal est la chaîne {@code "anonymousUser"}, qui est injectée sans
     * être nulle ni vide. Un test {@code userId == null} laisse donc passer un
     * appelant anonyme comme si c'était un utilisateur : il faut regarder le type
     * d'authentification.
     */
    private static String authenticatedUserId(Authentication authentication) {
        if (authentication == null
            || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal == null) {
            return null;
        }
        String userId = principal.toString();
        return userId.isBlank() ? null : userId;
    }

    private String buildFbAuthUrl(String callbackUri, String state, String platform) {
        String scope = "INSTAGRAM".equals(platform)
            ? "pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_comments,pages_read_engagement"
            : "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,public_profile";
        return UriComponentsBuilder.fromHttpUrl(FB_AUTH_URL)
            .queryParam("client_id",     fbAppId.isBlank() ? "YOUR_FB_APP_ID" : fbAppId)
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("state",         state)
            .queryParam("scope",         scope)
            .queryParam("response_type", "code")
            .build(false).toUriString();
    }

    private String buildLinkedinAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(LI_AUTH_URL)
            .queryParam("response_type", "code")
            .queryParam("client_id",     linkedinClientId.isBlank() ? "YOUR_LI_CLIENT_ID" : linkedinClientId)
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("state",         state)
            .queryParam("scope",         "openid profile email w_member_social")
            .build(false).toUriString();
    }

    private String buildTwitterAuthUrl(String callbackUri, String state, String codeVerifier) {
        // PKCE S256 — le vérificateur aléatoire ne quitte JAMAIS le serveur : il est
        // conservé dans l'état OAuth et rejoué uniquement lors de l'échange du code.
        String codeChallenge = OAuthStateStore.s256Challenge(codeVerifier);
        return UriComponentsBuilder.fromHttpUrl(TW_AUTH_URL)
            .queryParam("response_type",         "code")
            .queryParam("client_id",             twitterClientId.isBlank() ? "YOUR_TW_CLIENT_ID" : twitterClientId)
            .queryParam("redirect_uri",          callbackUri)
            .queryParam("state",                 state)
            .queryParam("scope",                 "tweet.read tweet.write users.read offline.access")
            .queryParam("code_challenge",        codeChallenge)
            .queryParam("code_challenge_method", "S256")
            .build(false).toUriString();
    }

    private String buildTiktokAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(TT_AUTH_URL)
            .queryParam("client_key",    tiktokClientKey.isBlank() ? "YOUR_TT_CLIENT_KEY" : tiktokClientKey)
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("state",         state)
            .queryParam("scope",         "user.info.basic,video.publish,video.upload")
            .queryParam("response_type", "code")
            .build(false).toUriString();
    }

    private String buildYoutubeAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(YT_AUTH_URL)
            .queryParam("client_id",             googleClientId.isBlank() ? "YOUR_GOOGLE_CLIENT_ID" : googleClientId)
            .queryParam("redirect_uri",          callbackUri)
            .queryParam("state",                 state)
            .queryParam("scope",                 "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly")
            .queryParam("response_type",         "code")
            .queryParam("access_type",           "offline")
            .queryParam("prompt",                "consent")
            .build(false).toUriString();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Handler OAuth callback générique
    // ═════════════════════════════════════════════════════════════════════════

    private ResponseEntity<Void> handleOAuthCallback(String code, String state, String error, String platform) {
        String redirectBase = frontendUrl + "/agentique/reseaux";

        // Erreur renvoyée par la plateforme
        if (error != null || code == null || code.isBlank()) {
            String msg = error != null ? error : "no_code";
            log.warn("[OAUTH_{}] Callback erreur: {}", platform, msg);
            return redirect(redirectBase + "?oauth_error=" + encode(msg) + "&platform=" + platform);
        }

        // Consommer l'état : à usage unique, il disparaît du store à cet appel.
        // Un state absent = rejeu, expiration, ou simple forçage d'une URL de
        // callback : dans les trois cas on refuse, l'agent n'est jamais touché.
        OAuthStateStore.Entry entry = stateStore.consume(state).orElse(null);
        if (entry == null) {
            log.warn("[OAUTH_{}] State absent, expiré ou déjà utilisé : {}", platform, state);
            return redirect(redirectBase + "?oauth_error=invalid_state&platform=" + platform);
        }

        // L'état est lié à la plateforme qui l'a émis : un state Facebook ne peut pas
        // être consommé sur le callback Twitter (sinon tokens d'une plateforme
        // accepted pour une autre).
        if (!entry.platform().equals(platform)) {
            log.warn("[OAUTH_{}] State émis pour {} présenté sur le callback {}",
                platform, entry.platform(), platform);
            return redirect(redirectBase + "?oauth_error=invalid_state&platform=" + platform);
        }

        String userId    = entry.userId();
        String agentId   = entry.agentId();
        String channelId = entry.channelId();

        try {
            String callbackUri = publicUrl + "/api/oauth/social/" + platform.toLowerCase() + "/callback";
            Map<String, Object> credentials =
                exchangeCodeForCredentials(platform, code, callbackUri, entry.codeVerifier());
            String accountName = (String) credentials.getOrDefault("accountName", platform + " Account");
            String accountId   = (String) credentials.getOrDefault("accountId", "");
            String credsJson   = objectMapper.writeValueAsString(credentials);

            if (channelId != null && !channelId.isBlank()) {
                // Mettre à jour un canal existant (createChannel/connect revalident
                // l'ownership de l'agent via resolveAgent).
                Channel ch = channelRepo.findById(channelId)
                    .filter(c -> c.getAgent().getId().equals(agentId))
                    .orElse(null);
                if (ch != null) {
                    ch.setEncryptedCredentials(encryptionService.encrypt(credsJson));
                    ch.setStatus(ChannelStatus.CONNECTED);
                    ch.setAccountName(accountName);
                    ch.setAccountId(accountId);
                    ch.setLastSyncAt(java.time.LocalDateTime.now());
                    channelRepo.save(ch);
                    log.info("[OAUTH_{}] Canal {} mis à jour et connecté", platform, channelId);
                }
            } else {
                // Créer un nouveau canal
                ChannelRequest req = new ChannelRequest(
                    ChannelType.SOCIAL_MEDIA,
                    PlatformType.valueOf(platform),
                    platform + " — " + accountName,
                    credsJson,
                    null,
                    accountId,
                    accountName
                );
                var resp = channelService.createChannel(userId, agentId, req);
                channelId = resp.id();
                // Marquer comme connecté
                channelService.connect(userId, agentId, channelId);
                log.info("[OAUTH_{}] Nouveau canal {} créé et connecté pour agent {}", platform, channelId, agentId);
            }

            return redirect(redirectBase + "?oauth_success=true&platform=" + platform + "&account=" + encode(accountName));

        } catch (Exception e) {
            // Le détail technique reste dans les logs : `e.getMessage()` peut contenir
            // des URLs d'API, des noms de colonnes ou des détails du fournisseur,
            // qui n'ont rien à faire dans l'URL redirigée vers le navigateur.
            log.error("[OAUTH_{}] Erreur échange code pour l'agent {} : {}", platform, agentId, e.getMessage(), e);
            return redirect(redirectBase + "?oauth_error=exchange_failed&platform=" + platform);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Échange du code OAuth contre les tokens selon la plateforme
    // ═════════════════════════════════════════════════════════════════════════

    private Map<String, Object> exchangeCodeForCredentials(String platform, String code,
                                                            String callbackUri, String codeVerifier) throws Exception {
        return switch (platform) {
            case "FACEBOOK", "INSTAGRAM" -> exchangeFbCode(platform, code, callbackUri);
            case "LINKEDIN"  -> exchangeLinkedinCode(code, callbackUri);
            case "TWITTER_X" -> exchangeTwitterCode(code, callbackUri, codeVerifier);
            case "TIKTOK"    -> exchangeTiktokCode(code, callbackUri);
            case "YOUTUBE"   -> exchangeYoutubeCode(code, callbackUri);
            default -> throw new IllegalArgumentException("Plateforme non supportée: " + platform);
        };
    }

    private Map<String, Object> exchangeFbCode(String platform, String code, String callbackUri) throws Exception {
        // 1. Échanger le code contre un Short-Lived Token
        String url = UriComponentsBuilder.fromHttpUrl(FB_TOKEN_URL)
            .queryParam("client_id",     fbAppId)
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("client_secret", fbAppSecret)
            .queryParam("code",          code)
            .build(false).toUriString();

        ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
        JsonNode tokenNode = objectMapper.readTree(resp.getBody());
        String shortToken = tokenNode.path("access_token").asText();

        // 2. Échanger contre un Long-Lived Token (60 jours)
        String llUrl = UriComponentsBuilder.fromHttpUrl(FB_TOKEN_URL)
            .queryParam("grant_type",        "fb_exchange_token")
            .queryParam("client_id",         fbAppId)
            .queryParam("client_secret",     fbAppSecret)
            .queryParam("fb_exchange_token", shortToken)
            .build(false).toUriString();
        ResponseEntity<String> llResp = restTemplate.getForEntity(llUrl, String.class);
        JsonNode llNode = objectMapper.readTree(llResp.getBody());
        String longToken = llNode.path("access_token").asText(shortToken);

        // 3. Récupérer les pages Facebook
        String pagesUrl = FB_PAGES_URL + "?access_token=" + longToken;
        ResponseEntity<String> pagesResp = restTemplate.getForEntity(pagesUrl, String.class);
        JsonNode pagesNode = objectMapper.readTree(pagesResp.getBody());

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("userAccessToken", longToken);

        // Prendre la première page
        JsonNode data = pagesNode.path("data");
        if (data.isArray() && data.size() > 0) {
            JsonNode page = data.get(0);
            String pageId          = page.path("id").asText();
            String pageAccessToken = page.path("access_token").asText();
            String pageName        = page.path("name").asText("Ma Page");
            creds.put("pageId",          pageId);
            creds.put("accessToken",     pageAccessToken);
            creds.put("pageName",        pageName);
            creds.put("accountId",       pageId);
            creds.put("accountName",     pageName);

            if ("INSTAGRAM".equals(platform)) {
                // Récupérer l'Instagram Business Account
                String igUrl = "https://graph.facebook.com/v19.0/" + pageId
                    + "?fields=instagram_business_account&access_token=" + pageAccessToken;
                try {
                    ResponseEntity<String> igResp = restTemplate.getForEntity(igUrl, String.class);
                    JsonNode igNode = objectMapper.readTree(igResp.getBody());
                    String igId = igNode.path("instagram_business_account").path("id").asText(null);
                    if (igId != null) {
                        creds.put("igUserId", igId);
                        creds.put("accountId", igId);
                    }
                } catch (Exception e) {
                    log.warn("[OAUTH_INSTAGRAM] Impossible de récupérer igUserId: {}", e.getMessage());
                }
            }
        } else {
            // Pas de page, utiliser user token
            creds.put("accessToken",  longToken);
            creds.put("accountName", "Facebook User");
            creds.put("accountId",   "");
        }

        return creds;
    }

    private Map<String, Object> exchangeLinkedinCode(String code, String callbackUri) throws Exception {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type",    "authorization_code");
        params.add("code",          code);
        params.add("redirect_uri",  callbackUri);
        params.add("client_id",     linkedinClientId);
        params.add("client_secret", linkedinClientSecret);

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<String> resp = restTemplate.postForEntity(LI_TOKEN_URL, new HttpEntity<>(params, h), String.class);
        JsonNode tok = objectMapper.readTree(resp.getBody());
        String accessToken  = tok.path("access_token").asText();
        String refreshToken = tok.path("refresh_token").asText(null);

        // Récupérer le profil
        HttpHeaders auth = new HttpHeaders();
        auth.setBearerAuth(accessToken);
        ResponseEntity<String> meResp = restTemplate.exchange(LI_ME_URL, org.springframework.http.HttpMethod.GET, new HttpEntity<>(auth), String.class);
        JsonNode me = objectMapper.readTree(meResp.getBody());
        String name = me.path("localizedFirstName").asText("") + " " + me.path("localizedLastName").asText("");
        String liId = me.path("id").asText("");

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("accessToken",  accessToken);
        creds.put("accountId",    liId);
        creds.put("accountName",  name.trim());
        if (refreshToken != null) creds.put("refreshToken", refreshToken);
        return creds;
    }

    private Map<String, Object> exchangeTwitterCode(String code, String callbackUri, String codeVerifier) throws Exception {
        if (codeVerifier == null || codeVerifier.isBlank()) {
            throw new IllegalStateException("Vérificateur PKCE absent pour l'échange Twitter");
        }

        String credentials = Base64.getEncoder().encodeToString(
            (twitterClientId + ":" + twitterClientSecret).getBytes(StandardCharsets.UTF_8));

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type",    "authorization_code");
        params.add("code",          code);
        params.add("redirect_uri",  callbackUri);
        params.add("code_verifier", codeVerifier);

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        h.set("Authorization", "Basic " + credentials);
        ResponseEntity<String> resp = restTemplate.postForEntity(TW_TOKEN_URL, new HttpEntity<>(params, h), String.class);
        JsonNode tok = objectMapper.readTree(resp.getBody());
        String accessToken  = tok.path("access_token").asText();
        String refreshToken = tok.path("refresh_token").asText(null);

        // Récupérer le profil
        HttpHeaders auth = new HttpHeaders();
        auth.setBearerAuth(accessToken);
        ResponseEntity<String> meResp = restTemplate.exchange(TW_ME_URL + "?user.fields=name,username", org.springframework.http.HttpMethod.GET, new HttpEntity<>(auth), String.class);
        JsonNode me = objectMapper.readTree(meResp.getBody()).path("data");
        String name = me.path("name").asText("Twitter User");
        String twId = me.path("id").asText("");

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("accessToken",  accessToken);
        creds.put("accountId",    twId);
        creds.put("accountName",  "@" + me.path("username").asText(name));
        if (refreshToken != null) creds.put("refreshToken", refreshToken);
        return creds;
    }

    private Map<String, Object> exchangeTiktokCode(String code, String callbackUri) throws Exception {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_key",    tiktokClientKey);
        params.add("client_secret", tiktokClientSecret);
        params.add("code",          code);
        params.add("grant_type",    "authorization_code");
        params.add("redirect_uri",  callbackUri);

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<String> resp = restTemplate.postForEntity(TT_TOKEN_URL, new HttpEntity<>(params, h), String.class);
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode data = root.path("data");
        String accessToken  = data.path("access_token").asText();
        String refreshToken = data.path("refresh_token").asText(null);
        String openId       = data.path("open_id").asText("");

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("accessToken",  accessToken);
        creds.put("openId",       openId);
        creds.put("accountId",    openId);
        creds.put("accountName",  "TikTok @" + openId);
        if (refreshToken != null) creds.put("refreshToken", refreshToken);
        return creds;
    }

    private Map<String, Object> exchangeYoutubeCode(String code, String callbackUri) throws Exception {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type",    "authorization_code");
        params.add("code",          code);
        params.add("redirect_uri",  callbackUri);
        params.add("client_id",     googleClientId);
        params.add("client_secret", googleClientSecret);

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<String> resp = restTemplate.postForEntity(YT_TOKEN_URL, new HttpEntity<>(params, h), String.class);
        JsonNode tok = objectMapper.readTree(resp.getBody());
        String accessToken  = tok.path("access_token").asText();
        String refreshToken = tok.path("refresh_token").asText(null);

        // Récupérer le canal YouTube
        HttpHeaders auth = new HttpHeaders();
        auth.setBearerAuth(accessToken);
        ResponseEntity<String> ytResp = restTemplate.exchange(YT_ME_URL, org.springframework.http.HttpMethod.GET, new HttpEntity<>(auth), String.class);
        JsonNode ytNode = objectMapper.readTree(ytResp.getBody());
        JsonNode channelNode = ytNode.path("items").size() > 0 ? ytNode.path("items").get(0) : objectMapper.createObjectNode();
        String channelId   = channelNode.path("id").asText("");
        String channelTitle = channelNode.path("snippet").path("title").asText("YouTube Channel");

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("accessToken",  accessToken);
        creds.put("channelId",    channelId);
        creds.put("accountId",    channelId);
        creds.put("accountName",  channelTitle);
        if (refreshToken != null) creds.put("refreshToken", refreshToken);
        return creds;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Utilitaires
    // ═════════════════════════════════════════════════════════════════════════

    private boolean isPlatformConfigured(String platform) {
        return switch (platform) {
            case "FACEBOOK", "INSTAGRAM" -> !fbAppId.isBlank() && !fbAppSecret.isBlank();
            case "LINKEDIN"  -> !linkedinClientId.isBlank() && !linkedinClientSecret.isBlank();
            case "TWITTER_X" -> !twitterClientId.isBlank() && !twitterClientSecret.isBlank();
            case "TIKTOK"    -> !tiktokClientKey.isBlank() && !tiktokClientSecret.isBlank();
            case "YOUTUBE"   -> !googleClientId.isBlank() && !googleClientSecret.isBlank();
            default -> false;
        };
    }

    private ResponseEntity<Void> redirect(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(java.net.URI.create(url));
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }

    private String encode(String value) {
        return value != null ? URLEncoder.encode(value, StandardCharsets.UTF_8) : "";
    }
}
