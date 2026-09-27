package com.creativeai.agentteam.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stockage des états OAuth en cours d'autorisation.
 *
 * Un `state` est la preuve qu'un utilisateur authentifié a lui-même démarré le flow.
 * Il est donc :
 *   - opaque et imprévisible (32 octets aléatoires, pas un UUID devinable) ;
 *   - lié à l'utilisateur, l'agent, le canal et la plateforme qui l'ont émis ;
 *   - à usage unique (consommé au callback, jamais rejouable) ;
 *   - borné dans le temps (TTL) pour qu'un state intercepté ne reste pas rejouable.
 *
 * L'association sert d'ancrage de sécurité : le callback est nécessairement public
 * (redirection navigateur de la plateforme), c'est ce state opaque à usage unique qui
 * prouve à quel utilisateur les tokens récupérés appartiennent. Sans cela, un attaquant
 * pourrait déclencher son propre flow puis rejouer le callback sur le state de sa victime
 * et rattacher ses tokens au compte de la victime (et inversement).
 */
@Slf4j
@Component
public class OAuthStateStore {

    /** Une entrée d'état, consommée une seule fois. */
    public record Entry(String userId,
                        String agentId,
                        String channelId,
                        String platform,
                        String codeVerifier,
                        Instant expiresAt) {
        public boolean isExpired(Instant now) {
            return now.isAfter(expiresAt);
        }
    }

    /** Ce que l'appelant reçoit : le state à mettre dans l'URL, et le vérificateur
     *  PKCE à ne transmettre qu'à la plateforme sous forme de défi S256. */
    public record Issued(String state, String codeVerifier) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Duration ttl;
    private final int maxEntries;

    public OAuthStateStore(@Value("${oauth.state.ttl-seconds:600}") long ttlSeconds,
                           @Value("${oauth.state.max-entries:10000}") int maxEntries) {
        // Plancher à 1 s : en dessous, un callback légitime (aller-retour vers la
        // plateforme) échouerait systématiquement. Un TTL de 600 s est le défaut.
        this.ttl = Duration.ofSeconds(Math.max(1, ttlSeconds));
        this.maxEntries = Math.max(100, maxEntries);
        if (ttlSeconds < 60) {
            log.warn("[OAUTH_STATE] TTL d'état OAuth très court : {} s", ttlSeconds);
        }
    }

    /**
     * Émet un nouvel état et retourne le token opaque correspondant.
     *
     * Le vérificateur PKCE est généré ici et conservé côté serveur : il ne doit
     * jamais quitter l'application autrement que redérivé en défi S256.
     */
    public Issued issue(String userId, String agentId, String channelId, String platform) {
        purgeExpired();
        if (entries.size() >= maxEntries) {
            // Refuser d'émettre plutôt que de laisser la structure grossir : le
            // client devra réessayer et l'espace mémoire reste borné.
            throw new IllegalStateException("Trop de flows OAuth en cours, réessayez dans un instant");
        }
        String state = randomToken(32);
        String codeVerifier = randomToken(32);
        entries.put(state, new Entry(userId, agentId, channelId, platform,
            codeVerifier, Instant.now().plus(ttl)));
        return new Issued(state, codeVerifier);
    }

    /**
     * Consomme un état : le retire du store (usage unique) et le retourne s'il
     * existe et n'a pas expiré.
     */
    public Optional<Entry> consume(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        Entry entry = entries.remove(state);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.isExpired(Instant.now())) {
            log.warn("[OAUTH_STATE] État expiré consommé tardivement pour la plateforme {}", entry.platform());
            return Optional.empty();
        }
        return Optional.of(entry);
    }

    /** Nombre d'états viva — pour les tests et le monitoring. */
    public int activeCount() {
        purgeExpired();
        return entries.size();
    }

    public Duration ttl() {
        return ttl;
    }

    /** Défi PKCE S256 : BASE64URL(SHA-256(verifier)), sans padding. */
    public static String s256Challenge(String codeVerifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }

    private String randomToken(int bytes) {
        byte[] buf = new byte[bytes];
        random.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        entries.entrySet().removeIf(e -> e.getValue().isExpired(now));
    }
}
