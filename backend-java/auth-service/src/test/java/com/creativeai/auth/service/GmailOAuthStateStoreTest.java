package com.creativeai.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link GmailOAuthStateStore}.
 *
 * <p>Le state Gmail valait auparavant {@code Base64(userId)}. Ces tests
 * documentent l'exploit qu'il rendait possible et le ferment.
 */
class GmailOAuthStateStoreTest {

    private GmailOAuthStateStore store;

    @BeforeEach
    void setUp() {
        store = new GmailOAuthStateStore(600, 10000);
    }

    @Test
    @DisplayName("le state est opaque : il ne contient plus le userId")
    void stateEstOpaque() {
        String state = store.issue("victime@exemple.com");

        // L'exploit historique : l'attaquant lisait l'userId dans le state.
        assertNotEquals("victime@exemple.com", state);
        assertFalse(state.contains("victime"));
        String decoded = new String(Base64.getUrlDecoder().decode(pad(state)), java.nio.charset.StandardCharsets.UTF_8);
        assertFalse(decoded.contains("victime"), "le userId ne doit pas être dérivable du state : " + decoded);
    }

    @Test
    @DisplayName("le state préfixé de l'userId de la victime est refusé")
    void stateForgeEstRefuse() {
        // Le scénario d'attaque : construire state = base64(victime) soi-même.
        String forged = Base64.getUrlEncoder().encodeToString(
            "victime@exemple.com".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertEquals(Optional.empty(), store.consume(forged));
    }

    @Test
    @DisplayName("usage unique : un state ne peut être rejoué")
    void usageUnique() {
        String state = store.issue("user@exemple.com");

        assertEquals(Optional.of("user@exemple.com"), store.consume(state));
        assertEquals(Optional.empty(), store.consume(state),
            "un state rejoué doit être refusé, sinon le callback est rejouable");
        assertEquals(0, store.activeCount());
    }

    @Test
    @DisplayName("deux flows parallèles ne se croisent pas")
    void flowsParalleles() {
        String stateA = store.issue("alice@exemple.com");
        String stateB = store.issue("bob@exemple.com");

        assertNotEquals(stateA, stateB);
        assertEquals(Optional.of("bob@exemple.com"), store.consume(stateB));
        assertEquals(Optional.of("alice@exemple.com"), store.consume(stateA));
    }

    @Test
    @DisplayName("state inconnu, vide ou nul → refusé")
    void statesInvalides() {
        assertEquals(Optional.empty(), store.consume(null));
        assertEquals(Optional.empty(), store.consume(""));
        assertEquals(Optional.empty(), store.consume("   "));
        assertEquals(Optional.empty(), store.consume("state-qui-n-existe-pas"));
    }

    @Test
    @DisplayName("state expiré → refusé")
    void stateExpire() {
        // TTL plancher à 1 s : impossible d'annuler un callback légitime.
        GmailOAuthStateStore court = new GmailOAuthStateStore(1, 10000);
        String state = court.issue("user@exemple.com");
        try {
            Thread.sleep(1100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        assertEquals(Optional.empty(), court.consume(state));
    }

    @Test
    @DisplayName("TTL aberrant ramené à au moins 1 s")
    void ttlAberrantRamene() {
        GmailOAuthStateStore store0 = new GmailOAuthStateStore(0, 10000);
        assertEquals(Optional.of("u@x.com"), store0.consume(store0.issue("u@x.com")),
            "un TTL de 0 s invaliderait tout callback légitime");
    }

    @Test
    @DisplayName("plafond d'entrées respecté")
    void plafondDEntrees() {
        GmailOAuthStateStore petit = new GmailOAuthStateStore(600, 100);
        for (int i = 0; i < 100; i++) {
            petit.issue("user" + i + "@x.com");
        }

        // Au-delà du maximum, on refuse d'émettre plutôt que de laisser la
        // structure grossir sans borne.
        try {
            petit.issue("trop@x.com");
            assertTrue(false, "le store devrait refuser au-delà du plafond");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("Trop de"));
        }
    }

    @Test
    @DisplayName("les states expirés sont purgés du store")
    void purgeDesExpires() {
        GmailOAuthStateStore court = new GmailOAuthStateStore(1, 10000);
        court.issue("a@x.com");
        try {
            Thread.sleep(1100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        assertEquals(0, court.activeCount());
    }

    private static String pad(String s) {
        int mod = s.length() % 4;
        return mod == 0 ? s : s + "=".repeat(4 - mod);
    }
}
