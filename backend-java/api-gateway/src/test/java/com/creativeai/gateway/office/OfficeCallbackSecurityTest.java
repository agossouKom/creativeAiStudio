package com.creativeai.gateway.office;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de sécurité du callback OnlyOffice.
 *
 * <p>Le endpoint n'avait aucune authentification et le gateway n'a pas de Spring
 * Security. La chaîne d'exploitation était :
 * <ol>
 *   <li>POST {@code /api/office/callback?key=choisi-par-l-moi} avec
 *       {@code {"status":2,"url":"http://169.254.169.254/..."}} ;</li>
 *   <li>GET {@code /api/office/download/meme-cle} → le gateway télécharge l'URL
 *       plantée et la relaie.</li>
 * </ol>
 * Deux verrous ferment la chaîne : la clé doit avoir été émise par ce gateway,
 * et l'URL doit viser l'hôte OnlyOffice.
 */
@ExtendWith(MockitoExtension.class)
class OfficeCallbackSecurityTest {

    @Mock private ReactiveStringRedisTemplate redis;
    @Mock private ReactiveValueOperations<String, String> valueOps;

    private OfficeController controller;

    @BeforeEach
    void setUp() {
        controller = new OfficeController(redis, "onlyoffice");
    }

    private void keyIsKnown(boolean known) {
        when(redis.hasKey(anyString())).thenReturn(Mono.just(known));
    }


    private Map<String, Object> body(String url) {
        return Map.of("status", 2, "url", url);
    }

    // ── SSRF ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("URL vers le metadata cloud → refusée, rien n'est écrit")
    void metadataCloudRefusee() {
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("http://169.254.169.254/latest/meta-data/iam/")).block());

        verify(valueOps, never()).set(anyString(), anyString(), any(Duration.class));
        verify(redis, never()).opsForValue();
    }

    @Test
    @DisplayName("URL vers un service Docker interne → refusée")
    void serviceInterneRefuse() {
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("http://postgres:5432/")).block());
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("http://redis:6379/")).block());
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("http://minio:9000/minio/health/live")).block());
    }

    @Test
    @DisplayName("URL en file:// ou gopher:// → refusée (parse ou hôte non autorisé)")
    void schemasExotiquesRefuses() {
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("file:///etc/passwd")).block());
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("gopher://127.0.0.1:11211/_x")).block());
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("pas-une-url")).block());
    }

    @Test
    @DisplayName("hôte pieégé via userinfo → refusé")
    void hotePiegeParUserinfo() {
        // http://onlyoffice@169.254.169.254/ se lit « hôte = onlyoffice » à la
        // lecture rapide ; getHost() renvoie en réalité 169.254.169.254. Le
        // contrôle explicite de userinfo verrouille ce cas.
        assertEquals(Map.of("error", 1), controller.callback("la-cle", body("http://onlyoffice@169.254.169.254/x")).block());
    }

    // ── Clé inventée ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("clé jamais émise par le gateway → refusée, même avec une URL OnlyOffice")
    void cleInconnueRefusee() {
        keyIsKnown(false);

        assertEquals(Map.of("error", 1), controller.callback("cle-que-jai-inventee", body("http://onlyoffice/cache/f.docx")).block());

        verify(redis, never()).opsForValue();
    }

    @Test
    @DisplayName("clé légitime + URL OnlyOffice → écrite")
    void cheminNominalFonctionne() {
        // Sans ce test, on risque de casser la sauvegarde de document : c'est le
        // contrat que le callback est censé remplir.
        when(redis.hasKey("office:html:la-cle")).thenReturn(Mono.just(true));
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.set(anyString(), anyString(), any(Duration.class))).thenReturn(Mono.just(Boolean.TRUE));

        assertEquals(Map.of("error", 0), controller.callback("la-cle", body("http://onlyoffice/cache/files/out.docx")).block());

        verify(valueOps).set("office:docx:la-cle", "http://onlyoffice/cache/files/out.docx", Duration.ofHours(24));
    }

    @Test
    @DisplayName("clé connue via office:docurl (étape de conversion) → acceptée")
    void cleConnueViaDocUrl() {
        when(redis.hasKey("office:html:la-cle")).thenReturn(Mono.just(false));
        when(redis.hasKey("office:docurl:la-cle")).thenReturn(Mono.just(true));
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.set(anyString(), anyString(), any(Duration.class))).thenReturn(Mono.just(Boolean.TRUE));

        assertEquals(Map.of("error", 0), controller.callback("la-cle", body("http://onlyoffice/cache/files/out.docx")).block());
    }

    // ── Statuts non concernés ────────────────────────────────────────────────

    @Test
    @DisplayName("status 1 ou 0 (pas encore prêt) → ignoré, aucune écriture")
    void statutsSansEcriture() {
        Map<String, Object> enCours = Map.of("status", 1, "url", "http://onlyoffice/x.docx");

        assertEquals(Map.of("error", 0), controller.callback("la-cle", enCours).block());

        verify(redis, never()).opsForValue();
    }

    @Test
    @DisplayName("clé absente → ignoré")
    void cleAbsente() {
        assertEquals(Map.of("error", 0), controller.callback(null, body("http://onlyoffice/x.docx")).block());
        verify(redis, never()).hasKey(anyString());
    }

    @Test
    @DisplayName("hôte supplémentaire autorisé explicitement → accepté")
    void hoteSurchargeable() {
        // Un OnlyOffice installé hors du réseau Docker doit rester utilisable,
        // mais seulement si l'administrateur le nomme.
        OfficeController local = new OfficeController(redis, "onlyoffice, oo.interne.labibpro.com");
        when(redis.hasKey("office:html:k")).thenReturn(Mono.just(true));
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.set(anyString(), anyString(), any(Duration.class))).thenReturn(Mono.just(Boolean.TRUE));

        assertEquals(Map.of("error", 0),
            local.callback("k", body("http://oo.interne.labibpro.com/cache/o.docx")).block());
    }
}
