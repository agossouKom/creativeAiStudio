package com.creativeai.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * États OAuth du flux Gmail.
 *
 * <p>Le flux Gmail utilisait jusqu'ici {@code state = Base64(userId)}. Ce n'était
 * pas un état au sens OAuth : c'était un identifiant en clair, que l'attaquant
 * pouvait fabriquer lui-même.
 *
 * <p>L'exploit était direct, et le service est exposé en production
 * ({@code GMAIL_CLIENT_ID}/{@code GMAIL_CLIENT_SECRET} y sont configurés) :
 * <ol>
 *   <li>{@code GET /api/auth/gmail/auth/url} était en {@code permitAll} et
 *       acceptait un {@code userId} en paramètre : n'importe qui obtenait une URL
 *       de consentement pour n'importe quel compte ;</li>
 *   <li>l'attaquant construisait à la main {@code state = base64(victime)} ;</li>
 *   <li>il menait le flux Google avec <b>son</b> compte Gmail, obtenait un
 *       {@code code} valide ;</li>
 *   <li>il rejouait {@code /gmail/callback?code=...&state=base64(victime)} : les
 *       tokens Gmail de l'attaquant étaient enregistrés sur le compte de la victime.</li>
 * </ol>
 * Conséquence : les agents de la victime lisaient et envoyaient des emails
 * <b>depuis la boîte de l'attaquant</b> — et tout ce que la victime envoyait
 * passait par cette boîte, copie à l'appui.
 *
 * <p>Ici, le state est un jeton opaque de 32 octets, à usage unique et borné à
 * {@code gmail.oauth.state.ttl-seconds} : seul un utilisateur authentifié peut
 * en obtenir un, et le callback ne peut pas deviner à qui il appartient.
 */
@Slf4j
@Component
public class GmailOAuthStateStore {

    private record Entry(String userId, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return now.isAfter(expiresAt);
        }
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Duration ttl;
    private final int maxEntries;

    public GmailOAuthStateStore(@Value("${gmail.oauth.state.ttl-seconds:600}") long ttlSeconds,
                                @Value("${gmail.oauth.state.max-entries:10000}") int maxEntries) {
        this.ttl = Duration.ofSeconds(Math.max(1, ttlSeconds));
        this.maxEntries = Math.max(100, maxEntries);
    }

    /** Émet un state opaque lié à l'utilisateur authentifié qui l'a demandé. */
    public String issue(String userId) {
        purgeExpired();
        if (entries.size() >= maxEntries) {
            throw new IllegalStateException("Trop de connexions Gmail en cours, réessayez dans un instant");
        }
        String state = randomToken(32);
        entries.put(state, new Entry(userId, Instant.now().plus(ttl)));
        return state;
    }

    /**
     * Consomme un state et retourne l'utilisateur correspondant.
     * Usage unique : un state rejoué est refusé, qu'il soit valide ou expiré.
     */
    public Optional<String> consume(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        Entry entry = entries.remove(state);
        if (entry == null || entry.isExpired(Instant.now())) {
            return Optional.empty();
        }
        return Optional.of(entry.userId());
    }

    public int activeCount() {
        purgeExpired();
        return entries.size();
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
