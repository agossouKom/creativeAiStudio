package com.creativeai.agentteam.security;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Vérification des requêtes de webhook entrantes (Meta Facebook/WhatsApp, Telegram).
 *
 * <p>Ce composant centralise trois règles qui étaient violées partout dans les
 * contrôleurs de webhook :
 *
 * <ol>
 *   <li><b>Aucun secret dev par défaut.</b> Les valeurs par défaut
 *       {@code creativeai-facebook-verify} et {@code creativeai-whatsapp-verify}
 *       étaient écrites en dur dans le dépôt : quiconque lisait le code pouvait
 *       s'enregistrer en tant que fournisseur et injecter des tâches.</li>
 *   <li><b>Aucun repli fail-open.</b> Un secret absent ne doit pas vouloir dire
 *       « signature non vérifiée, requête acceptée » : cela rend l'arrêt du
 *       conteneur de secrets — ou simplement une variable d'environnement
 *       oubliée — suffirait à ouvrir l'endpoint. Un secret manquant <b>désactive</b> l'endpoint
 *       (503), il ne l'ouvre pas.</li>
 *   <li><b>Comparaison en temps constant.</b> {@code String.equals} s'arrête au
 *       premier octet différent : la durée de la réponse permet de reconstruire
 *       la signature octet par octet.</li>
 * </ol>
 *
 * <p>Les valeurs sont lues ici, et non dans chaque contrôleur, pour qu'il n'y
 * ait qu'un seul endroit où elles sont définies et un seul rapport de démarrage
 * ({@link #reportStartup()}) indiquant ce qui est actif et ce qui est désactivé.
 */
@Slf4j
@Component
public class WebhookVerifier {

    /** Résultat d'une vérification, pour que l'appelant distingue les causes. */
    public enum Verdict {
        /** La requête est authentifiée, traitement possible. */
        OK,
        /** La requête porte une signature/secret, mais faux. */
        BAD_SIGNATURE,
        /** Le secret serveur n'est pas configuré : l'endpoint est désactivé. */
        NOT_CONFIGURED
    }

    // ── Secrets ──────────────────────────────────────────────────────────────
    // Défauts volontairement VIDES : une valeur dev en dur est un secret publié.

    @Value("${facebook.verify-token:}")   private String facebookVerifyToken;
    @Value("${facebook.app-secret:}")     private String facebookAppSecret;
    @Value("${instagram.verify-token:}")  private String instagramVerifyToken;
    @Value("${instagram.app-secret:}")    private String instagramAppSecret;
    @Value("${whatsapp.verify-token:}")   private String whatsappVerifyToken;
    @Value("${whatsapp.app-secret:}")     private String whatsappAppSecret;
    @Value("${telegram.webhook-secret:}") private String telegramWebhookSecret;

    @Getter private Verdict facebookState;
    @Getter private Verdict instagramState;
    @Getter private Verdict whatsappState;
    @Getter private Verdict telegramState;

    /** Rapport unique au démarrage : impossible de ne pas voir ce qui est désactivé. */
    @PostConstruct
    public void reportStartup() {
        facebookState = describe(facebookVerifyToken, facebookAppSecret);
        instagramState = describe(instagramVerifyToken, getInstagramAppSecret());
        whatsappState = describe(whatsappVerifyToken, whatsappAppSecret);
        telegramState = describe(telegramWebhookSecret);

        log.info("[WEBHOOK] Configuration au démarrage — "
                + "facebook.verify-token={}, facebook.app-secret={}, "
                + "instagram.verify-token={}, instagram.app-secret={}, "
                + "whatsapp.verify-token={}, whatsapp.app-secret={}, telegram.webhook-secret={}",
            present(facebookVerifyToken), present(facebookAppSecret),
            present(instagramVerifyToken), present(instagramAppSecret),
            present(whatsappVerifyToken), present(whatsappAppSecret), present(telegramWebhookSecret));

        warnIfDisabled("facebook", facebookState, "FACEBOOK_VERIFY_TOKEN", "FACEBOOK_APP_SECRET");
        warnIfDisabled("whatsapp", whatsappState, "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET");
        if (instagramState == Verdict.NOT_CONFIGURED) {
            // Le message cite les deux noms de variable parce que l'app-secret
            // Instagram retombe sur celui de Facebook : l'opérateur doit savoir
            // que poser seulement FACEBOOK_APP_SECRET ne suffit pas.
            log.error("[WEBHOOK] ⚠️  instagram : configuration incomplète → /api/instagram/webhook "
                + "REFUSERA toutes les requêtes (fail-closed, 503). Définir INSTAGRAM_VERIFY_TOKEN et "
                + "INSTAGRAM_APP_SECRET (ou leurs équivalents FACEBOOK_VERIFY_TOKEN / FACEBOOK_APP_SECRET).");
        }
        if (telegramState == Verdict.NOT_CONFIGURED) {
            log.error("[WEBHOOK] ⚠️  TELEGRAM : secret absent → /api/telegram/webhook REFUSERA "
                + "toutes les requêtes (fail-closed). Définir TELEGRAM_WEBHOOK_SECRET pour l'activer.");
        }
    }

    private Verdict describe(String... requiredSecrets) {
        for (String secret : requiredSecrets) {
            if (isBlank(secret)) {
                return Verdict.NOT_CONFIGURED;
            }
        }
        return Verdict.OK;
    }

    private void warnIfDisabled(String label, Verdict state, String varA, String varB) {
        if (state == Verdict.NOT_CONFIGURED) {
            log.error("[WEBHOOK] ⚠️  {} : configuration incomplète → les endpoints {} seront "
                + "REFUSÉS (fail-closed, 503). Définir {} / {} pour les activer.", label, label, varA, varB);
        }
    }

    private String present(String s) {
        return isBlank(s) ? "ABSENT" : "défini";
    }

    // ── Vérifications ────────────────────────────────────────────────────────

    /**
     * Vérifie le header {@code X-Hub-Signature-256} de Meta
     * ({@code sha256=<hex du HMAC-SHA256 du corps brut>}).
     *
     * @param secret le app-secret Meta ; s'il est vide, l'endpoint est désactivé
     */
    public Verdict checkMetaSignature(String payload, String signatureHeader, String secret) {
        if (isBlank(secret)) {
            return Verdict.NOT_CONFIGURED;
        }
        // Normalisation unique, avant toute comparaison : sinon le contrôle de
        // préfixe et la comparaison de l'hex reposaient sur des règles différentes.
        String presented = signatureHeader == null ? "" : signatureHeader.trim();
        if (presented.length() < 7 || !presented.regionMatches(true, 0, "sha256=", 0, 7)) {
            return Verdict.BAD_SIGNATURE;
        }
        byte[] expected;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            expected = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            // Une exception crypto ne doit JAMAI valider la requête.
            log.error("[WEBHOOK] Erreur de calcul HMAC : {}", e.getMessage());
            return Verdict.BAD_SIGNATURE;
        }
        // Comparaison sur l'hex seul, insensible à la casse : le préfixe a déjà
        // été validé ci-dessus, et Meta envoie de l'hex minuscule — accepter
        // « SHA256= » à la porte puis refuser sur la comparaison serait
        // incohérent.
        String expectedHex = HexFormat.of().formatHex(expected);
        String presentedHex = presented.substring(7);
        return constantTimeEqualsIgnoreCase(expectedHex, presentedHex) ? Verdict.OK : Verdict.BAD_SIGNATURE;
    }

    /**
     * Vérifie un secret simple (verify_token Meta, secret_token Telegram).
     *
     * @param expected le secret serveur ; vide ⇒ endpoint désactivé
     */
    public Verdict checkToken(String presented, String expected) {
        if (isBlank(expected)) {
            return Verdict.NOT_CONFIGURED;
        }
        if (presented == null) {
            return Verdict.BAD_SIGNATURE;
        }
        return constantTimeEquals(expected, presented) ? Verdict.OK : Verdict.BAD_SIGNATURE;
    }

    public Verdict checkFacebookSignature(String payload, String signature) {
        return checkMetaSignature(payload, signature, facebookAppSecret);
    }

    /**
     * App-secret Meta global.
     *
     * <p>Utilisé par {@code FacebookWebhookController} pour les callbacks par
     * canal : Meta signe toujours {@code X-Hub-Signature-256} avec le secret de
     * l'application, jamais avec le token de page du canal.
     */
    public String getFacebookAppSecret() {
        return facebookAppSecret;
    }

    public Verdict checkWhatsAppSignature(String payload, String signature) {
        return checkMetaSignature(payload, signature, whatsappAppSecret);
    }

    public Verdict checkFacebookToken(String presented) {
        return checkToken(presented, facebookVerifyToken);
    }

    /**
     * Signature du webhook Instagram.
     *
     * <p>Même secret que Facebook dans le cas nominal : les deux objets sont
     * servis par UNE application Meta, et {@code X-Hub-Signature-256} est toujours
     * signé avec l'app-secret, jamais avec un token de compte.
     */
    public Verdict checkInstagramSignature(String payload, String signature) {
        return checkMetaSignature(payload, signature, getInstagramAppSecret());
    }

    public Verdict checkInstagramToken(String presented) {
        return checkToken(presented, instagramVerifyToken);
    }

    /**
     * App-secret Meta pour les endpoints Instagram.
     *
     * <p>Repli sur l'app-secret Facebook quand aucune app Meta dédiée à Instagram
     * n'est configurée — le cas nominal, une seule application Meta sert aux deux
     * objets. Le repli est appliqué ici et pas seulement dans le {@code yml} pour
     * que {@link #checkInstagramSignature} et ce getter ne puissent pas diverger :
     * deux réponses différentes à la même question de configuration.
     */
    public String getInstagramAppSecret() {
        return isBlank(instagramAppSecret) ? facebookAppSecret : instagramAppSecret;
    }

    public Verdict checkWhatsAppToken(String presented) {
        return checkToken(presented, whatsappVerifyToken);
    }

    public Verdict checkTelegramSecret(String presented) {
        return checkToken(presented, telegramWebhookSecret);
    }

    // ── Aides pour les contrôleurs ───────────────────────────────────────────

    /**
     * Traduit un verdict en réponse HTTP, pour que les contrôleurs n'aient qu'à
     * écrire {@code if (refus != null) return refus;}.
     *
     * @return {@code null} si le verdict est {@link Verdict#OK}, sinon la réponse à renvoyer
     */
    public ResponseEntity<String> refusalFor(Verdict verdict, String label) {
        return switch (verdict) {
            case OK -> null;
            // 403 et non 401 : ce n'est pas le client qui est « non authentifié »,
            // c'est une requête non signée dont la source est douteuse.
            case BAD_SIGNATURE -> {
                log.warn("[WEBHOOK] {} : signature/secret invalide — requête rejetée", label);
                yield ResponseEntity.status(403).body("Forbidden");
            }
            // 503 et non 403 : le problème est notre configuration, pas la requête.
            // Le distinction importe pour l'opérateur — un 503 doit se voir dans les alertes.
            case NOT_CONFIGURED -> {
                log.error("[WEBHOOK] {} : secret serveur ABSENT — endpoint désactivé (fail-closed). "
                    + "La requête n'est PAS traitée.", label);
                yield ResponseEntity.status(503).body("Webhook non configuré");
            }
        };
    }

    // ── Utilitaires ──────────────────────────────────────────────────────────

    /**
     * Comparaison en temps constant. Les longueurs différentes sont un cas
     * particulier : elles fuient déjà la longueur attendue, ce qui est sans
     * conséquence ici (longueurs fixes : 64 hex, UUID v4, secret arbitraire
     * dont la longueur n'est pas un secret protégé).
     */
    static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(
            a.getBytes(StandardCharsets.UTF_8),
            b.getBytes(StandardCharsets.UTF_8));
    }

    /** Comme {@link #constantTimeEquals}, mais insensible à la casse (hex). */
    static boolean constantTimeEqualsIgnoreCase(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        // Majuscules avant comparaison : la normalisation doit être faite sur
        // les DEUX chaînes, sinon la longueur peut différer et fuiter.
        return MessageDigest.isEqual(
            a.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8),
            b.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
