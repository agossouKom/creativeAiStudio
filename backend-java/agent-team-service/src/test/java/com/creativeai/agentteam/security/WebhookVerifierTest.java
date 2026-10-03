package com.creativeai.agentteam.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link WebhookVerifier}.
 *
 * <p>Chaque test « fail-closed » ci-dessous échouerait avec l'ancienne
 * implémentation, qui faisait : secret vide ⇒ « signature non vérifiée »
 * ⇒ requête acceptée.
 */
class WebhookVerifierTest {

    private WebhookVerifier verifier;

    private static final String SECRET = "s3cr3t-app-secret";
    private static final String PAYLOAD = "{\"object\":\"page\",\"entry\":[]}";

    @BeforeEach
    void setUp() {
        verifier = new WebhookVerifier();
    }

    private void configure(String facebookVerify, String facebookAppSecret,
                           String whatsappVerify, String whatsappAppSecret,
                           String telegramSecret) {
        ReflectionTestUtils.setField(verifier, "facebookVerifyToken", facebookVerify);
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", facebookAppSecret);
        ReflectionTestUtils.setField(verifier, "whatsappVerifyToken", whatsappVerify);
        ReflectionTestUtils.setField(verifier, "whatsappAppSecret", whatsappAppSecret);
        ReflectionTestUtils.setField(verifier, "telegramWebhookSecret", telegramSecret);
    }

    /**
     * Variante « une seule application Meta » : Instagram n'a pas ses propres
     * variables, il retombe sur celles de Facebook (cf. application.yml).
     */
    private void configureInstagramSharingFacebookSecrets() {
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken",
            ReflectionTestUtils.getField(verifier, "facebookVerifyToken"));
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", "");
    }

    /** Signature Meta : sha256=HMAC-SHA256(corps, secret), hex minuscule. */
    private static String metaSignature(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    // ── Signature Meta ───────────────────────────────────────────────────────

    @Test
    @DisplayName("signature Meta valide → OK")
    void signatureValideAcceptee() throws Exception {
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkMetaSignature(PAYLOAD, metaSignature(PAYLOAD, SECRET), SECRET));
    }

    @Test
    @DisplayName("signature calculée avec un autre secret → refusée")
    void signatureAvecMauvaisSecretRefusee() throws Exception {
        String forged = metaSignature(PAYLOAD, "autre-secret");
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(PAYLOAD, forged, SECRET));
    }

    @Test
    @DisplayName("corps modifié après signature → refusée (rejeu)")
    void corpsModifieRefuse() throws Exception {
        String signature = metaSignature(PAYLOAD, SECRET);
        String altered = PAYLOAD.replace("page", "user");
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(altered, signature, SECRET));
    }

    @Test
    @DisplayName("secret serveur VIDE → l'endpoint est fermé, même avec une signature plausible")
    void secretVideRefuseMemeSignatureValide() throws Exception {
        // On ne peut pas forge une signature « valide » pour un secret vide :
        // SecretKeySpec refuse une clé vide. Ce qui compte, c'est que la
        // demande soit close SANS regarder la signature : c'est bien le cas.
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED,
            verifier.checkMetaSignature(PAYLOAD, "sha256=" + "0".repeat(64), ""));
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED,
            verifier.checkMetaSignature(PAYLOAD, metaSignature(PAYLOAD, SECRET), ""));
    }

    @Test
    @DisplayName("headers de signature absents ou malformés → refusés")
    void headersMalformesRefuses() {
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(PAYLOAD, null, SECRET));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(PAYLOAD, "", SECRET));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(PAYLOAD, "deadbeef", SECRET));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkMetaSignature(PAYLOAD, "sha1=abcd", SECRET));
    }

    @Test
    @DisplayName("hex de la signature accepté en majuscules comme en minuscules")
    void hexInsensibleALaCasse() throws Exception {
        String sig = metaSignature(PAYLOAD, SECRET);
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkMetaSignature(PAYLOAD, "SHA256=" + sig.substring(7), SECRET));
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkMetaSignature(PAYLOAD, "sha256=" + sig.substring(7).toUpperCase(), SECRET));
    }

    @Test
    @DisplayName("espaces autour de la signature tolérés")
    void espacesToleres() throws Exception {
        String sig = metaSignature(PAYLOAD, SECRET);
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkMetaSignature(PAYLOAD, "  " + sig + "  ", SECRET));
    }

    // ── Secret simple (verify_token, secret Telegram) ────────────────────────

    @Test
    @DisplayName("secret Telegram : bon secret OK, mauvais refusé, absent refusé")
    void secretTelegram() {
        configure("", "", "", "", "mon-secret-telegram");

        assertEquals(WebhookVerifier.Verdict.OK, verifier.checkTelegramSecret("mon-secret-telegram"));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE, verifier.checkTelegramSecret("autre"));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE, verifier.checkTelegramSecret(null));
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE, verifier.checkTelegramSecret(""));
    }

    @Test
    @DisplayName("secret Telegram VIDE → endpoint fermé, requête non traitée")
    void secretTelegramVideFermeLEpping() {
        // Avant : `if (!webhookSecret.isBlank() && !webhookSecret.equals(secret))`
        // → avec la variable vide, la condition était fausse et la requête
        // passait. C'est le fail-open le plus directement exploitable du lot :
        // POST sans header, création de tâche au nom d'un userId au choix.
        configure("", "", "", "", "");
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.checkTelegramSecret(null));
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.checkTelegramSecret("n'importe quoi"));
    }

    @Test
    @DisplayName("verify token Meta absent → handshake impossible")
    void verifyTokenAbsent() {
        configure("", SECRET, "", SECRET, "x");
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.checkFacebookToken("quelconque"));
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.checkWhatsAppToken("quelconque"));
    }

    // ── Comparaison en temps constant ────────────────────────────────────────

    @Test
    @DisplayName("comparaison constante : null et longueurs différentes gérés")
    void comparaisonNulle() {
        assertFalse(WebhookVerifier.constantTimeEquals(null, "a"));
        assertFalse(WebhookVerifier.constantTimeEquals("a", null));
        assertFalse(WebhookVerifier.constantTimeEquals(null, null));
        assertTrue(WebhookVerifier.constantTimeEquals("a", "a"));
        assertFalse(WebhookVerifier.constantTimeEquals("a", "b"));
        assertFalse(WebhookVerifier.constantTimeEquals("a", "ab"));
    }

    // ── Traduction en réponse HTTP ───────────────────────────────────────────

    @Test
    @DisplayName("refusalFor : null si OK, 403 si mauvais, 503 si non configuré")
    void traductionEnReponse() {
        assertNotNull(verifier.refusalFor(WebhookVerifier.Verdict.BAD_SIGNATURE, "test"));
        assertEquals(403, verifier.refusalFor(WebhookVerifier.Verdict.BAD_SIGNATURE, "test").getStatusCode().value());
        assertEquals(503, verifier.refusalFor(WebhookVerifier.Verdict.NOT_CONFIGURED, "test").getStatusCode().value());
        assertEquals(null, verifier.refusalFor(WebhookVerifier.Verdict.OK, "test"));
    }

    // ── Rapport de démarrage ─────────────────────────────────────────────────

    @Test
    @DisplayName("rapport de démarrage : signale chaque webhook non configuré")
    void rapportDemarrageSignaleLesManques() {
        // Sans ce rapport, une variable oubliée ne se voyait qu'en consultant
        // le code : les webhooks semblaient simplement « inactifs ».
        configure("tok", "", "", "", "");

        verifier.reportStartup();

        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.getFacebookState());
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.getWhatsappState());
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.getTelegramState());
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.getInstagramState());
    }

    // ── Instagram ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Instagram sans secret propre → repli sur l'app-secret Facebook")
    void instagramReprendLesSecretsFacebook() {
        // Une seule application Meta sert aux deux objets. Si l'endpoint
        // Instagram exigeait son propre secret sans repli, il répondrait 503 en
        // production alors que tout est configuré côté Meta.
        configure("tok", SECRET, "tok2", SECRET, "tg");
        configureInstagramSharingFacebookSecrets();

        verifier.reportStartup();

        assertEquals(SECRET, verifier.getInstagramAppSecret());
        assertEquals(WebhookVerifier.Verdict.OK, verifier.getInstagramState());
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkInstagramToken("tok"));
    }

    @Test
    @DisplayName("Instagram : un secret dédié prend le pas sur celui de Facebook")
    void instagramSecretDediePrioritaire() throws Exception {
        String dedicated = "app-secret-instagram";
        configure("tok", SECRET, "tok2", SECRET, "tg");
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "tok-ig");
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", dedicated);

        assertEquals(dedicated, verifier.getInstagramAppSecret());
        // Signature calculée avec le mauvais secret : c'est bien le dédié qui est utilisé.
        assertEquals(WebhookVerifier.Verdict.BAD_SIGNATURE,
            verifier.checkInstagramSignature(PAYLOAD, metaSignature(PAYLOAD, SECRET)));
        assertEquals(WebhookVerifier.Verdict.OK,
            verifier.checkInstagramSignature(PAYLOAD, metaSignature(PAYLOAD, dedicated)));
    }

    @Test
    @DisplayName("Instagram : aucun secret Meta du tout → endpoint fermé (503)")
    void instagramSansAucunSecretFerme() {
        configure("", "", "", "", "");
        configureInstagramSharingFacebookSecrets();

        verifier.reportStartup();

        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED, verifier.getInstagramState());
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED,
            verifier.checkInstagramToken("n'importe quoi"));
        assertEquals(WebhookVerifier.Verdict.NOT_CONFIGURED,
            verifier.checkInstagramSignature(PAYLOAD, "sha256=deadbeef"));
    }

    @Test
    @DisplayName("rapport de démarrage : tout configuré → aucun état désactivé")
    void rapportDemarrageToutConfigure() {
        configure("tok", SECRET, "tok2", SECRET, "tg");
        configureInstagramSharingFacebookSecrets();

        verifier.reportStartup();

        assertEquals(WebhookVerifier.Verdict.OK, verifier.getFacebookState());
        assertEquals(WebhookVerifier.Verdict.OK, verifier.getInstagramState());
        assertEquals(WebhookVerifier.Verdict.OK, verifier.getWhatsappState());
        assertEquals(WebhookVerifier.Verdict.OK, verifier.getTelegramState());
    }

    @Test
    @DisplayName("le rapport ne lève pas quand les champs @Value n'ont pas été injectés")
    void rapportSansInjection() {
        // Au démarrage réel, Spring injecte avant @PostConstruct. En test isolé,
        // les champs sont null : le rapport ne doit pas planter, sinon le
        // démarrage du service échouerait sur un bug de rapport.
        new WebhookVerifier().reportStartup();
    }
}
