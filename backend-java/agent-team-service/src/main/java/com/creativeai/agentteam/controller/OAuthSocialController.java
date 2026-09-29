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
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.creativeai.agentteam.service.UserSocialAccountService;
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
    /**
     * Identifiants applicatifs saisis par l'administrateur dans le dashboard,
     * avec repli sur les variables d'environnement. Résolu à chaque appel pour
     * qu'une correction dans le dashboard prenne effet sans redémarrage.
     */
    private final SocialPlatformConfigService platformConfig;

    /**
     * Enregistre en parallèle le compte unifié de l'utilisateur. Le canal garde
     * ses propres credentials : l'écriture du compte ne doit jamais pouvoir
     * faire échouer une connexion qui fonctionne déjà.
     */
    private final UserSocialAccountService userSocialAccounts;

    // ── Config ───────────────────────────────────────────────────────────────

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
    private static final String FB_ME_URL     = "https://graph.facebook.com/v19.0/me";

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
        String callbackUri = resolveCallbackUri(platformUpper);

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

            // ADDITIF : ces deux champs n'existent que si le canal a été créé
            // par un échange OAuth remontant plusieurs Pages. Un canal historique
            // n'en a pas → le frontend n'affiche aucun sélecteur et la
            // publication continue exactement comme avant.
            boolean pageSelectionPending = false;
            int availablePageCount = 0;
            if (ch != null && ch.getEncryptedCredentials() != null) {
                Map<String, Object> creds = decryptCredentials(ch);
                pageSelectionPending = Boolean.TRUE.equals(creds.get("pageSelectionPending"));
                if (creds.get("availablePages") instanceof List<?> list) {
                    availablePageCount = list.size();
                }
            }

            result.add(Map.of(
                "platform",     platform.name(),
                "connected",    ch != null && ch.getStatus() == ChannelStatus.CONNECTED,
                "channelId",    ch != null ? ch.getId() : "",
                "accountName",  ch != null && ch.getAccountName() != null ? ch.getAccountName() : "",
                "configured",   isPlatformConfigured(platform.name()),
                "lastSync",     ch != null && ch.getLastSyncAt() != null ? ch.getLastSyncAt().toString() : "",
                "pageSelectionPending", pageSelectionPending,
                "availablePageCount",   availablePageCount
            ));
        }
        return ResponseEntity.ok(result);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Choix de la Page (Meta) — un utilisateur peut gérer plusieurs Pages
    // ═════════════════════════════════════════════════════════════════════════

    @Operation(summary = "Pages Facebook disponibles pour le canal, et Page actuellement utilisée")
    @GetMapping("/{platform}/pages/{channelId}")
    public ResponseEntity<Map<String, Object>> listPages(
            Authentication authentication,
            @PathVariable String platform,
            @PathVariable String channelId) {
        ChannelLookup lookup = lookupOwnedChannel(authentication, platform, channelId);
        if (lookup.error() != null) return lookup.error();
        return ResponseEntity.ok(pagesPayload(lookup.channel()));
    }

    @Operation(summary = "Basculer le canal sur une autre Page Facebook")
    @PostMapping("/{platform}/pages/{channelId}/select")
    public ResponseEntity<Map<String, Object>> selectPage(
            Authentication authentication,
            @PathVariable String platform,
            @PathVariable String channelId,
            @RequestBody(required = false) Map<String, Object> body) {

        ChannelLookup lookup = lookupOwnedChannel(authentication, platform, channelId);
        if (lookup.error() != null) return lookup.error();

        Channel channel = lookup.channel();
        Map<String, Object> creds = decryptCredentials(channel);
        List<?> pages = (List<?>) creds.get("availablePages");
        if (pages == null || pages.isEmpty()) {
            // Une seule Page : rien à choisir, c'est le cas normal, pas une erreur.
            Map<String, Object> nothingToChoose = pagesPayload(channel);
            nothingToChoose.put("changed", false);
            nothingToChoose.put("reason", "single_page");
            return ResponseEntity.ok(nothingToChoose);
        }

        Object wanted = body == null ? null : body.get("pageId");
        if (wanted == null || String.valueOf(wanted).isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "pageId est obligatoire"));
        }

        // On n'accepte QUE les pages déjà revues lors de l'échange OAuth.
        // Sans ce filtre, un utilisateur pourrait faire pointer son canal vers
        // une Page tierce en forgeant un pageId dans le corps de la requête.
        Map<String, Object> target = null;
        for (Object o : pages) {
            if (o instanceof Map<?, ?> m
                && String.valueOf(wanted).equals(String.valueOf(m.get("id")))) {
                target = new LinkedHashMap<>((Map<String, Object>) m);
                break;
            }
        }

        if (target == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Cette page ne fait pas partie de vos pages connectées"));
        }

        try {
            applyPage(platform, creds, target);
        } catch (Exception e) {
            log.warn("[OAUTH_{}] Page {} non sélectable : {}", platform, wanted, e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", describePageFailure(platform, e)));
        }

        creds.put("pageSelectionPending", false);
        try {
            channel.setEncryptedCredentials(encryptionService.encrypt(objectMapper.writeValueAsString(creds)));
            channel.setAccountId((String) creds.get("accountId"));
            channel.setAccountName((String) creds.get("accountName"));
            // Même libellé que celui créé par le callback OAuth (plateforme en
            // majuscules), sinon le canal apparaît deux fois dans les listes.
            channel.setDisplayName(platform.toUpperCase(Locale.ROOT) + " — " + creds.get("accountName"));
            channel.setStatus(ChannelStatus.CONNECTED);
            channel.setLastSyncAt(java.time.LocalDateTime.now());
            channelRepo.save(channel);
        } catch (Exception e) {
            log.error("[OAUTH_{}] Echec sauvegarde du canal {} : {}", platform, channelId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Impossible d'enregistrer la sélection"));
        }

        log.info("[OAUTH_{}] Canal {} basculé sur la page {} ({})",
            platform, channelId, creds.get("accountName"), wanted);
        Map<String, Object> body2 = pagesPayload(channel);
        body2.put("changed", true);
        return ResponseEntity.ok(body2);
    }

    private record ChannelLookup(Channel channel, ResponseEntity<Map<String, Object>> error) {}

    /**
     * Résout le canal en vérifiant l'ownership. Un canal inconnu, une
     * plateforme incohérente et un agent appartenant à quelqu'un d'autre
     * renvoient tous 403 : on ne veut pas laisser un utilisateur authentifié
     * énumérer l'existence de canaux d'autrui.
     */
    private ChannelLookup lookupOwnedChannel(Authentication authentication, String platform, String channelId) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return new ChannelLookup(null, ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Authentification requise")));
        }
        Channel channel = channelRepo.findById(channelId).orElse(null);
        if (channel == null
            || channel.getType() != ChannelType.SOCIAL_MEDIA
            || channel.getPlatformType() == null
            || !channel.getPlatformType().name().equalsIgnoreCase(platform)
            || agentRepo.findByIdAndOwnerIdAndDeletedFalse(channel.getAgent().getId(), userId).isEmpty()) {
            return new ChannelLookup(null, ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Canal introuvable ou non autorisé")));
        }
        return new ChannelLookup(channel, null);
    }


    /** Réponse de /pages et /select : jamais de token dans la réponse. */
    private Map<String, Object> pagesPayload(Channel channel) {
        Map<String, Object> creds = decryptCredentials(channel);
        List<?> pages = (List<?>) creds.get("availablePages");

        List<Map<String, String>> safe = new ArrayList<>();
        if (pages != null) {
            for (Object o : pages) {
                if (o instanceof Map<?, ?> p) {
                    // On ne renvoie QUE l'id et le nom : jamais accessToken.
                    safe.add(Map.of(
                        "id",   String.valueOf(p.get("id")),
                        "name", String.valueOf(p.get("name"))));
                }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pageId",   String.valueOf(creds.getOrDefault("pageId", "")));
        out.put("pageName", String.valueOf(creds.getOrDefault("pageName", channel.getAccountName())));
        out.put("pages",    safe);
        return out;
    }

    private Map<String, Object> decryptCredentials(Channel channel) {
        Map<String, Object> creds = new LinkedHashMap<>();
        if (channel.getEncryptedCredentials() == null) return creds;
        try {
            String plain = encryptionService.decrypt(channel.getEncryptedCredentials());
            return objectMapper.readValue(plain, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Impossible de déchiffrer les credentials du canal {} : {}",
                channel.getId(), e.getMessage());
            return creds;
        }
    }

    /** Bascule les credentials sur une autre Page, Instagram inclus. */
    private void applyPage(String platform, Map<String, Object> creds, Map<String, Object> target)
            throws Exception {
        String pageId          = String.valueOf(target.get("id"));
        String pageAccessToken = String.valueOf(target.get("accessToken"));
        String pageName        = String.valueOf(target.getOrDefault("name", "Ma Page"));

        creds.put("pageId",      pageId);
        creds.put("accessToken", pageAccessToken);
        creds.put("pageName",    pageName);
        creds.put("accountId",   pageId);
        creds.put("accountName", pageName);

        if ("INSTAGRAM".equalsIgnoreCase(platform)) {
            // Instagram n'existe pas seul : il faut re-résoudre l'id du compte
            // professionnel rattaché à CETTE page, pas à la précédente.
            String igId = fetchIgBusinessId(pageId, pageAccessToken);
            if (igId == null || igId.isBlank()) {
                throw new IllegalStateException("no_ig_account");
            }
            creds.put("igUserId", igId);
            creds.put("accountId", igId);
        }
    }

    private String fetchIgBusinessId(String pageId, String pageAccessToken) {
        String igUrl = "https://graph.facebook.com/v19.0/" + pageId
            + "?fields=instagram_business_account&access_token=" + pageAccessToken;
        try {
            ResponseEntity<String> igResp = restTemplate.getForEntity(igUrl, String.class);
            JsonNode igNode = objectMapper.readTree(igResp.getBody());
            return igNode.path("instagram_business_account").path("id").asText(null);
        } catch (Exception e) {
            log.warn("[OAUTH_INSTAGRAM] Impossible de récupérer igUserId pour la page {} : {}",
                pageId, e.getMessage());
            return null;
        }
    }

    private String describePageFailure(String platform, Exception e) {
        if ("INSTAGRAM".equalsIgnoreCase(platform)) {
            return "Cette page n'a pas de compte Instagram professionnel associé. "
                 + "Reliez le compte Instagram à la page, puis réessayez.";
        }
        return "Impossible d'utiliser cette page : " + e.getMessage();
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
        UriComponentsBuilder url = UriComponentsBuilder.fromHttpUrl(FB_AUTH_URL)
            .queryParam("client_id",     clientIdOr("FACEBOOK", "YOUR_FB_APP_ID"))
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("state",         state)
            .queryParam("response_type", "code");

        // ── Facebook Login for Business (prioritaire) ──────────────────────
        // Meta veut les permissions Pages demandées via une configuration
        // créée dans le dashboard : config_id REMPLACE scope. Envoyer les deux
        // fait échouer le dialog, et c'est ce dialogue qui accordait les
        // permissions que Facebook refusait ensuite en « Invalid Scopes ».
        String configId = platformConfig.resolveFacebookConfigId(platform);
        if (configId != null) {
            log.info("[OAUTH] Facebook Login for Business : config_id={} (scope ignoré)", configId);
            return url.queryParam("config_id", configId)
                // Force le code même si la configuration Meta déclare un autre
                // response_type par défaut : l'échange se fait côté serveur.
                .queryParam("override_default_response_type", "true")
                .build(false).toUriString();
        }

        // ── Facebook Login classique : scopes du dashboard, sinon défauts ──
        List<String> configured = platformConfig.resolveScopes(platform);
        String scope = !configured.isEmpty()
            ? String.join(",", configured)
            : "INSTAGRAM".equals(platform)
                ? "pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_comments,pages_read_engagement"
                : "pages_show_list,pages_read_engagement,pages_manage_posts,public_profile";
        return url.queryParam("scope", scope).build(false).toUriString();
    }

    private String buildLinkedinAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(LI_AUTH_URL)
            .queryParam("response_type", "code")
            .queryParam("client_id",     clientIdOr("LINKEDIN", "YOUR_LI_CLIENT_ID"))
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
            .queryParam("client_id",             clientIdOr("TWITTER_X", "YOUR_TW_CLIENT_ID"))
            .queryParam("redirect_uri",          callbackUri)
            .queryParam("state",                 state)
            .queryParam("scope",                 "tweet.read tweet.write users.read offline.access")
            .queryParam("code_challenge",        codeChallenge)
            .queryParam("code_challenge_method", "S256")
            .build(false).toUriString();
    }

    private String buildTiktokAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(TT_AUTH_URL)
            .queryParam("client_key",    clientIdOr("TIKTOK", "YOUR_TT_CLIENT_KEY"))
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("state",         state)
            .queryParam("scope",         "user.info.basic,video.publish,video.upload")
            .queryParam("response_type", "code")
            .build(false).toUriString();
    }

    private String buildYoutubeAuthUrl(String callbackUri, String state) {
        return UriComponentsBuilder.fromHttpUrl(YT_AUTH_URL)
            .queryParam("client_id",             clientIdOr("YOUTUBE", "YOUR_GOOGLE_CLIENT_ID"))
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
            String callbackUri = resolveCallbackUri(platform);
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

            // Le compte unifié est écrit APRÈS le canal, et jamais dans le même
            // état de transaction : si cette étape échoue, la publication
            // fonctionne toujours via les credentials du canal.
            linkUserSocialAccount(userId, platform, accountId, accountName, credsJson);

            return redirect(redirectBase + "?oauth_success=true&platform=" + platform + "&account=" + encode(accountName));

        } catch (Exception e) {
            // Le détail technique reste dans les logs : `e.getMessage()` peut contenir
            // des URLs d'API, des noms de colonnes ou des détails du fournisseur,
            // qui n'ont rien à faire dans l'URL redirigée vers le navigateur.
            log.error("[OAUTH_{}] Erreur échange code pour l'agent {} : {}", platform, agentId, e.getMessage(), e);
            return redirect(redirectBase + "?oauth_error=exchange_failed&platform=" + platform);
        }
    }

    /**
     * Best-effort : toute erreur ici est journalisée puis ignorée. Le canal vient
     * d'être écrit avec les mêmes credentials, donc l'utilisateur reste connecté
     * même si la table des comptes unifiés est indisponible.
     */
    private void linkUserSocialAccount(String userId, String platform, String accountId,
                                      String accountName, String credsJson) {
        try {
            userSocialAccounts.recordFromOauth(userId, platform, accountId,
                accountName, credsJson, null);
        } catch (RuntimeException e) {
            log.error("[OAUTH_{}] Enregistrement du compte unifié impossible pour {} : {}",
                platform, userId, e.getMessage(), e);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Échange du code OAuth contre les tokens selon la plateforme
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * URI de redirection OAuth à transmettre à la plateforme : celle que
     * l'administrateur a saisie dans le dashboard (domaine + chemin), avec
     * repli sur {@code APP_PUBLIC_URL} + chemin par défaut. Résolue à chaque
     * appel pour qu'un changement de domaine prenne effet sans redémarrage.
     */
    private String resolveCallbackUri(String platform) {
        return platformConfig.resolveCallback(platform).uri();
    }

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
            .queryParam("client_id",     clientId("FACEBOOK"))
            .queryParam("redirect_uri",  callbackUri)
            .queryParam("client_secret", clientSecret("FACEBOOK"))
            .queryParam("code",          code)
            .build(false).toUriString();

        ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
        JsonNode tokenNode = objectMapper.readTree(resp.getBody());
        String shortToken = tokenNode.path("access_token").asText();

        // 2. Échanger contre un Long-Lived Token (60 jours)
        String llUrl = UriComponentsBuilder.fromHttpUrl(FB_TOKEN_URL)
            .queryParam("grant_type",        "fb_exchange_token")
            .queryParam("client_id",         clientId("FACEBOOK"))
            .queryParam("client_secret",     clientSecret("FACEBOOK"))
            .queryParam("fb_exchange_token", shortToken)
            .build(false).toUriString();
        ResponseEntity<String> llResp = restTemplate.getForEntity(llUrl, String.class);
        JsonNode llNode = objectMapper.readTree(llResp.getBody());
        String longToken = llNode.path("access_token").asText(shortToken);

        Map<String, Object> creds = new LinkedHashMap<>();
        creds.put("userAccessToken", longToken);
        // Durée de vie du long-lived token (Meta renvoie expires_in en secondes) :
        // conservée pour que le job de refresh sache quand prolonger via
        // fb_exchange_token.
        long expiresIn = llNode.path("expires_in").asLong(0);
        if (expiresIn > 0) {
            creds.put("expiresIn", expiresIn);
        }

        // 2bis. Identifiant Meta app-scoped de l'utilisateur : indispensable pour
        // traiter le webhook deauthorize (RGPD) — Meta nous le renvoie quand
        // l'utilisateur supprime l'app. Best-effort : sans lui, la publication
        // et le refresh restent fonctionnels.
        try {
            String meUrl = FB_ME_URL + "?fields=id&access_token=" + longToken;
            JsonNode meNode = objectMapper.readTree(restTemplate.getForEntity(meUrl, String.class).getBody());
            String fbUserId = meNode.path("id").asText(null);
            if (fbUserId != null && !fbUserId.isBlank()) {
                creds.put("fbUserId", fbUserId);
            }
        } catch (Exception e) {
            log.warn("[OAUTH_{}] Impossible de récupérer l'identifiant Meta : {}", platform, e.getMessage());
        }

        // 3. Récupérer les pages Facebook
        String pagesUrl = FB_PAGES_URL + "?access_token=" + longToken;
        ResponseEntity<String> pagesResp = restTemplate.getForEntity(pagesUrl, String.class);
        JsonNode pagesNode = objectMapper.readTree(pagesResp.getBody());

        // Prendre la première page
        JsonNode data = pagesNode.path("data");
        if (data.isArray() && data.size() > 0) {
            // ADDITIF : l'utilisateur peut gérer plusieurs Pages. On continue
            // d'utiliser la première comme défaut (donc le canal reste
            // publiable immédiatement, exactement comme avant) mais on conserve
            // la liste complète pour qu'il puisse basculer ensuite via
            // POST /{platform}/pages/{channelId}/select.
            if (data.size() > 1) {
                List<Map<String, String>> pages = new ArrayList<>();
                for (JsonNode p : data) {
                    pages.add(Map.of(
                        "id",          p.path("id").asText(),
                        "name",        p.path("name").asText("Ma Page"),
                        "accessToken", p.path("access_token").asText("")));
                }
                creds.put("availablePages", pages);
                creds.put("pageSelectionPending", true);
            }

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
        params.add("client_id",     clientId("LINKEDIN"));
        params.add("client_secret", clientSecret("LINKEDIN"));

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
            (nullSafe(clientId("TWITTER_X")) + ":" + nullSafe(clientSecret("TWITTER_X")))
                .getBytes(StandardCharsets.UTF_8));

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
        params.add("client_key",    clientId("TIKTOK"));
        params.add("client_secret", clientSecret("TIKTOK"));
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
        params.add("client_id",     clientId("YOUTUBE"));
        params.add("client_secret", clientSecret("YOUTUBE"));

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
        return platformConfig.resolve(platform).isPresent();
    }

    /**
     * Identifiants effectifs d'une plateforme : saisie admin si elle existe,
     * variable d'environnement sinon. Les champs @Value restent le repli.
     */
    private String clientId(String platform) {
        var creds = platformConfig.resolve(platform);
        if (creds.isPresent()) return creds.clientId();
        return switch (platform) {
            case "FACEBOOK", "INSTAGRAM" -> nullIfBlank(fbAppId);
            case "LINKEDIN"  -> nullIfBlank(linkedinClientId);
            case "TWITTER_X" -> nullIfBlank(twitterClientId);
            case "TIKTOK"    -> nullIfBlank(tiktokClientKey);
            case "YOUTUBE"   -> nullIfBlank(googleClientId);
            default -> null;
        };
    }

    private String clientSecret(String platform) {
        var creds = platformConfig.resolve(platform);
        if (creds.isPresent()) return creds.clientSecret();
        return switch (platform) {
            case "FACEBOOK", "INSTAGRAM" -> nullIfBlank(fbAppSecret);
            case "LINKEDIN"  -> nullIfBlank(linkedinClientSecret);
            case "TWITTER_X" -> nullIfBlank(twitterClientSecret);
            case "TIKTOK"    -> nullIfBlank(tiktokClientSecret);
            case "YOUTUBE"   -> nullIfBlank(googleClientSecret);
            default -> null;
        };
    }

    /** Identifiant effectif, ou un placeholder lisible sur l'écran d'admin. */
    private String clientIdOr(String platform, String placeholder) {
        String v = clientId(platform);
        return (v == null || v.isBlank()) ? placeholder : v;
    }

    /** Évite qu'un "null" parte dans une chaîne de signature Basic. */
    private String nullSafe(String v) {
        return v == null ? "" : v;
    }

    private String nullIfBlank(String v) {
        return (v == null || v.isBlank()) ? null : v;
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
