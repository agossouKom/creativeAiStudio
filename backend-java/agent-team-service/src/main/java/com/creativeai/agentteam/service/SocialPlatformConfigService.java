package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Résout les identifiants applicatifs d'un réseau, en privilégiant ce que
 * l'administrateur a saisi dans le dashboard.
 *
 * Ordre de priorité, et pourquoi :
 *   1. la table `social_platforms` — c'est le nouvel espace de gestion ;
 *   2. les variables d'environnement — l'existant.
 *
 * Ce repli n'est pas cosmétique : la prod tourne aujourd'hui avec des variables
 * d'environnement, et tant que l'administrateur n'a rien saisi, on doit
 * continuer à fonctionner exactement comme avant. Le moment où l'un des deux
 * existe suffit à basculer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialPlatformConfigService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String GRAPH_HOST = "https://graph.facebook.com";

    /**
     * Repli quand l'administrateur n'a pas saisi de version. v24.0 : publiée
     * le 8 octobre 2025, supportée jusqu'au 18 février 2028. Volontairement pas
     * la dernière (v26.0, juillet 2026) — un major tout neuf est le pire choix
     * pour une intégration de publication.
     */
    static final String DEFAULT_GRAPH_VERSION = "v24.0";

    private final SocialPlatformRepository repository;
    private final EncryptionService encryptionService;

    @Value("${oauth.facebook.app-id:}")
    private String fbAppId;
    @Value("${oauth.facebook.app-secret:}")
    private String fbAppSecret;
    @Value("${oauth.linkedin.client-id:}")
    private String linkedinClientId;
    @Value("${oauth.linkedin.client-secret:}")
    private String linkedinClientSecret;
    @Value("${oauth.twitter.client-id:}")
    private String twitterClientId;
    @Value("${oauth.twitter.client-secret:}")
    private String twitterClientSecret;
    @Value("${oauth.tiktok.client-key:}")
    private String tiktokClientKey;
    @Value("${oauth.tiktok.client-secret:}")
    private String tiktokClientSecret;
    // YouTube réutilise l'application Google du module Gmail : les mêmes noms de
    // variables que OAuthSocialController, sinon le repli environnement serait
    // silencieusement vide en déploiement.
    @Value("${GMAIL_CLIENT_ID:}")
    private String googleClientId;
    @Value("${GMAIL_CLIENT_SECRET:}")
    private String googleClientSecret;

    /** Repli si le dashboard n'a pas renseigné de domaine public. */
    @Value("${app.public-url:http://localhost:8480}")
    private String publicUrl;

    /** Résultat de résolution, avec la provenance pour que l'admin sache quoi corriger. */
    public record Credentials(String clientId, String clientSecret, boolean fromDatabase) {
        public boolean isPresent() {
            return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
        }
    }

    /**
     * Domaine + chemin de callback OAuth d'une plateforme. Saisissables dans le
     * dashboard (zéro hardcoding) ; tant que vides, on retombe sur
     * {@code APP_PUBLIC_URL} + le chemin par défaut — le comportement d'origine.
     */
    public record CallbackConfig(String baseUrl, String path, boolean fromDatabase) {
        public String uri() {
            String b = baseUrl;
            while (b != null && b.endsWith("/")) b = b.substring(0, b.length() - 1);
            String p = (path == null || path.isBlank()) ? "/" : path;
            return (p.startsWith("/") || b == null || b.isBlank()) ? b + p : b + "/" + p;
        }
    }

    /**
     * Instagram passe par la même application que Facebook : les deux
     * plateformes partagent une entrée dans le dashboard, comme sur Meta.
     */
    public String resolvePlatformId(String platform) {
        if (platform == null) return null;
        return switch (platform.toUpperCase()) {
            case "INSTAGRAM" -> "facebook";
            case "TWITTER", "X" -> "twitter_x";
            case "GOOGLE", "YOUTUBE" -> "youtube";
            default -> platform.toLowerCase();
        };
    }

    @Transactional(readOnly = true)
    public Credentials resolve(String platform) {
        String platformId = resolvePlatformId(platform);
        if (platformId == null) return new Credentials(null, null, false);

        Optional<SocialPlatform> found = repository.findById(platformId);
        if (found.isPresent()) {
            SocialPlatform sp = found.get();
            if (sp.getClientId() != null && !sp.getClientId().isBlank()) {
                String secret = null;
                if (sp.getClientSecretEnc() != null && !sp.getClientSecretEnc().isBlank()) {
                    try {
                        secret = encryptionService.decrypt(sp.getClientSecretEnc());
                    } catch (Exception e) {
                        // Un secret illisible ne doit pas empêcher le démarrage :
                        // on retombe sur l'environnement plutôt que de planter.
                        log.error("Secret illisible pour la plateforme {} : {}", platformId, e.getMessage());
                    }
                }
                if (secret != null && !secret.isBlank()) {
                    return new Credentials(sp.getClientId(), secret, true);
                }
            }
        }
        return fromEnvironment(platform);
    }

    private Credentials fromEnvironment(String platform) {
        return switch (platform.toUpperCase()) {
            case "FACEBOOK", "INSTAGRAM" -> new Credentials(fbAppId, fbAppSecret, false);
            case "LINKEDIN"  -> new Credentials(linkedinClientId, linkedinClientSecret, false);
            case "TWITTER_X" -> new Credentials(twitterClientId, twitterClientSecret, false);
            case "TIKTOK"    -> new Credentials(tiktokClientKey, tiktokClientSecret, false);
            case "YOUTUBE"   -> new Credentials(googleClientId, googleClientSecret, false);
            default -> new Credentials(null, null, false);
        };
    }

    /**
     * Résout l'URI de callback OAuth : la ligne du dashboard fait foi, sinon
     * {@code APP_PUBLIC_URL} + chemin par défaut (l'existant, jamais cassé).
     * Utile pour les échanges de code ET pour afficher l'URL à déclarer dans la
     * console de la plateforme.
     */
    @Transactional(readOnly = true)
    public CallbackConfig resolveCallback(String platform) {
        String platformId = resolvePlatformId(platform);
        if (platformId == null) {
            return new CallbackConfig(publicUrl, defaultCallbackPath(platform), false);
        }
        SocialPlatform sp = repository.findById(platformId).orElse(null);
        if (sp != null && (sp.getBaseRedirectUrl() != null || sp.getCallbackPath() != null)) {
            return new CallbackConfig(
                sp.getBaseRedirectUrl() == null ? publicUrl : sp.getBaseRedirectUrl(),
                sp.getCallbackPath() == null ? defaultCallbackPath(platform) : sp.getCallbackPath(),
                true);
        }
        return new CallbackConfig(publicUrl, defaultCallbackPath(platform), false);
    }

    private String defaultCallbackPath(String platform) {
        if (platform == null) return "/";
        // resolvePlatformId normalise INSTAGRAM→facebook : il ne faut PAS
        // l'utiliser ici, chaque plateforme a son propre chemin de callback.
        return "/api/oauth/social/" + platform.toLowerCase() + "/callback";
    }

    /**
     * Scopes demandés au consentement OAuth : ce que l'administrateur a saisi
     * dans le dashboard (colonne {@code scopes}) fait foi. Repli : liste par
     * défaut de la plateforme — l'existant, jamais cassé.
     *
     * <p>Instagram partage la ligne « facebook » : si l'admin n'a rien saisi de
     * spécifique (aucun scope {@code instagram_*}), on renvoie ses défauts à lui
     * pour ne pas casser la publication de vidéos.
     */
    @Transactional(readOnly = true)
    public List<String> resolveScopes(String platform) {
        if (platform == null) return new ArrayList<>();
        String platformId = resolvePlatformId(platform);
        SocialPlatform sp = platformId == null ? null : repository.findById(platformId).orElse(null);
        List<String> fromDb = (sp == null || sp.getScopes() == null || sp.getScopes().isBlank())
            ? new ArrayList<>() : sp.scopeList();

        if ("INSTAGRAM".equals(platform.toUpperCase())
            && fromDb.stream().noneMatch(s -> s.startsWith("instagram_"))) {
            return List.of(
                "pages_show_list", "instagram_basic", "instagram_content_publish",
                "instagram_manage_comments", "pages_read_engagement");
        }
        return fromDb;
    }

    /**
     * Facebook Login for Business : identifiant de configuration Meta, lu dans
     * {@code extra_config.fbBusinessConfigId}.
     *
     * <p>Meta veut désormais les permissions Pages demandées via une
     * configuration créée dans le dashboard ({@code config_id}) et non via un
     * {@code scope} brut. La configuration porte à la fois les permissions et
     * les assets (Pages, comptes Instagram) : elle est donc propre à une
     * plateforme. Facebook et Instagram partagent la même ligne en base, mais
     * pas les mêmes permissions ({@code pages_*} contre {@code instagram_*}) :
     * seule Facebook lit sa configuration ici, sinon on enverrait les scopes
     * Instagram à un dialog Facebook.
     *
     * @return l'identifiant, ou {@code null} → repli sur le Facebook Login classique
     */
    @Transactional(readOnly = true)
    public String resolveFacebookConfigId(String platform) {
        String platformId = resolvePlatformId(platform);
        if (platformId == null || !"facebook".equals(platformId) || platform == null) {
            return null;
        }
        return repository.findById(platformId)
            .map(SocialPlatform::getExtraConfig)
            .map(json -> readStringField(json, "fbBusinessConfigId"))
            .orElse(null);
    }

    /**
     * Version de la Graph API Meta, lue dans {@code extra_config.graphVersion}.
     *
     * <p>Meta ne garde chaque version que deux ans, et une version expirée ne
     * provoque <em>aucune</em> erreur : les appels y sont silencieusement
     * re-routés vers la plus ancienne version encore vivante. Un numéro en dur
     * dans le code est donc une dette invisible — c'est ce qui faisait tourner
     * l'app en v19.0 (expirée le 21 mai 2026) sans que rien ne le signale. La
     * version est donc une donnée, saisie par l'administrateur, comme les
     * scopes.
     *
     * @return la version, ou {@link #DEFAULT_GRAPH_VERSION} si la plateforme est
     *         absente ou mal renseignée
     */
    @Transactional(readOnly = true)
    public String resolveGraphVersion(String platform) {
        String version = null;
        String platformId = resolvePlatformId(platform);
        if (platformId != null) {
            version = repository.findById(platformId)
                .map(SocialPlatform::getExtraConfig)
                .map(json -> readStringField(json, "graphVersion"))
                .orElse(null);
        }
        return isUsableGraphVersion(version) ? version : DEFAULT_GRAPH_VERSION;
    }

    /** Racine de l'API pour une plateforme, version comprise. */
    @Transactional(readOnly = true)
    public String graphBaseUrl(String platform) {
        return GRAPH_HOST + "/" + resolveGraphVersion(platform);
    }

    /**
     * Une version se valide sur sa forme ({@code vNN.N}) : un champ vide, un
     * slash ou une chaîne tronquée produirait une URL cassée en silence.
     */
    private static boolean isUsableGraphVersion(String value) {
        return value != null && value.matches("v\\d{2}\\.\\d+");
    }

    /** Lit un champ texte de l'{@code extra_config} JSON, sans jamais planter. */
    private static String readStringField(String json, String field) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode node = MAPPER.readTree(json).get(field);
            if (node == null || node.isNull()) return null;
            String value = node.asText();
            return (value == null || value.isBlank()) ? null : value.trim();
        } catch (Exception e) {
            log.warn("extra_config illisible, {} ignoré : {}", field, e.getMessage());
            return null;
        }
    }

    /**
     * Ce qu'indique le dashboard à l'administrateur : la plateforme est-elle
     * activée, et où sont ses identifiants ? Jamais le secret lui-même.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> adminStatus(String platform) {
        Map<String, Object> out = new LinkedHashMap<>();
        String platformId = resolvePlatformId(platform);
        SocialPlatform sp = platformId == null ? null : repository.findById(platformId).orElse(null);

        Credentials creds = resolve(platform);
        out.put("platform", platform);
        out.put("inDatabase", sp != null);
        out.put("isActive", sp == null || Boolean.TRUE.equals(sp.getIsActive()));
        out.put("configured", creds.isPresent());
        out.put("fromDatabase", creds.fromDatabase());
        out.put("clientIdHint", mask(creds.clientId()));
        return out;
    }

    /** Aperçu non réversible : assez pour reconnaître, pas assez pour utiliser. */
    private String mask(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.length() <= 4) return "****";
        return value.substring(0, 2) + "…" + value.substring(value.length() - 2);
    }
}
