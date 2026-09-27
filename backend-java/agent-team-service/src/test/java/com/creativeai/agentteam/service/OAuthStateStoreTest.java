package com.creativeai.agentteam.service;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Garantit qu'un `state` OAuth est imprévisible, à usage unique, borné dans le
 * temps et lié à son émetteur. C'est le seul garde-fou du callback, qui est
 * nécessairement public.
 */
class OAuthStateStoreTest {

    @Test
    void stateEstOpaqueEtImprevisible() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);

        String state = store.issue("user-1", "agent-1", null, "FACEBOOK").state();

        // Un UUID (ce qui était utilisé avant) est devinable et court ; on veut
        // au moins 128 bits d'entropie encodés.
        assertTrue(state.length() >= 40, "state trop court : " + state);
        Set<String> states = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            states.add(store.issue("user-1", "agent-1", null, "FACEBOOK").state());
        }
        assertEquals(200, states.size(), "états dupliqués : le state n'est pas aléatoire");
    }

    @Test
    void stateLieUtilisateurAgentCanalEtPlateforme() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);

        OAuthStateStore.Issued issued = store.issue("user-42", "agent-7", "channel-3", "LINKEDIN");
        OAuthStateStore.Entry entry = store.consume(issued.state()).orElseThrow();

        assertEquals("user-42", entry.userId());
        assertEquals("agent-7", entry.agentId());
        assertEquals("channel-3", entry.channelId());
        assertEquals("LINKEDIN", entry.platform());
    }

    @Test
    void stateEstASUsageUnique() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);
        String state = store.issue("user-1", "agent-1", null, "FACEBOOK").state();

        assertTrue(store.consume(state).isPresent());
        // Rejeu : le state a disparu, un second usage doit échouer.
        assertTrue(store.consume(state).isEmpty(), "un state rejoué a été accepté");
        assertEquals(0, store.activeCount());
    }

    @Test
    void stateInconnuOuAbsentEstRefuse() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);

        assertTrue(store.consume(null).isEmpty(), "state null accepté");
        assertTrue(store.consume("").isEmpty(), "state vide accepté");
        assertTrue(store.consume("   ").isEmpty(), "state blanc accepté");
        assertTrue(store.consume("jamais-emis").isEmpty(), "state forgé accepté");
    }

    @Test
    void stateExpireApresLeTtl() throws InterruptedException {
        OAuthStateStore store = new OAuthStateStore(1, 1000);
        String state = store.issue("user-1", "agent-1", null, "FACEBOOK").state();

        Thread.sleep(1200);

        assertTrue(store.consume(state).isEmpty(), "un state expiré a été accepté");
    }

    @Test
    void emissionRefuseeQuandLeStoreEstSature() {
        OAuthStateStore store = new OAuthStateStore(600, 100);
        for (int i = 0; i < 100; i++) {
            store.issue("user-1", "agent-1", null, "FACEBOOK");
        }

        // Sans plafond, une boucle de /authorize grossirait la map sans fin.
        assertThrows(IllegalStateException.class,
            () -> store.issue("user-1", "agent-1", null, "FACEBOOK"));
    }

    @Test
    void challengePkceS256ConformeAuVecteurRfc7636() {
        // RFC 7636 appendix B : c'est le seul moyen de prouver qu'on ne fait plus
        // du code_challenge = state en method=plain.
        String verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

        assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            OAuthStateStore.s256Challenge(verifier));
    }

    @Test
    void verificateurPkceNestJamaisDeriveDuState() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);

        OAuthStateStore.Issued issued = store.issue("user-1", "agent-1", null, "TWITTER_X");

        assertNotEquals(issued.state(), issued.codeVerifier());
        assertNotEquals(OAuthStateStore.s256Challenge(issued.state()), issued.codeVerifier());
    }

    @Test
    void chaqueFlowRecoitUnVerificateurDistinct() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);

        Set<String> verifiers = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            verifiers.add(store.issue("user-1", "agent-1", null, "TWITTER_X").codeVerifier());
        }

        assertEquals(100, verifiers.size());
    }

    @Test
    void etatConsommeNEstPasVisibleDansActiveCount() {
        OAuthStateStore store = new OAuthStateStore(600, 1000);
        Optional<OAuthStateStore.Entry> entry =
            store.consume(store.issue("user-1", "agent-1", null, "TIKTOK").state());

        assertTrue(entry.isPresent());
        assertEquals(0, store.activeCount());
    }
}
