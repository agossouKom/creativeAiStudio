package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.enums.PlatformType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Anti-doublon pour les événements entrants (webhooks Meta et pollers).
 *
 * <p>Un même commentaire peut être vu <b>deux fois</b> : par le webhook Meta
 * (livraison « au moins une fois » — Meta réémet sur timeout ou 5xx) et par le
 * polling toutes les {@code *_POLL_DELAY_MS} s, les deux cheminements étant
 * activables en même temps. Sans marqueur partagé, l'agent crée deux tâches et
 * répond deux fois au même commentaire.
 *
 * <p>Les préfixes sont donc partagés avec {@code FacebookCommentPollerService}
 * et {@code InstagramCommentPollerService} : webhook et poller se neutralisent
 * mutuellement, quelle que soit la voie qui arrive en premier.
 *
 * <p><b>Ce composant est volontairement fail-open</b>, à l'inverse de
 * {@link com.creativeai.agentteam.security.WebhookVerifier} : si Redis est
 * indisponible, on préfère traiter un événement en double plutôt que perdre
 * silencieusement un commentaire client. Un doublon se corrige à la main, une
 * réclamation client perdue se découvre sur le réseau social.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookEventDeduplicator {

    /** Marqueur « déjà vu » des commentaires Facebook (webhook + poller). */
    public static final String FB_SEEN_PREFIX = "fb:seen:";
    /** Marqueur « déjà vu » des commentaires Instagram (webhook + poller). */
    public static final String IG_SEEN_PREFIX = "ig:seen:";

    /** 7 jours : couvre largement le délai de réémission de Meta. */
    private static final Duration SEEN_TTL = Duration.ofDays(7);

    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Enregistre l'identifiant comme vu et répond {@code true} s'il ne l'était pas.
     *
     * <p>SET NX d'un coup, et non {@code hasKey} puis {@code set} : deux livraisons
     * concurrentes du même commentaire (Meta réémet en parallèle sur timeout)
     * passeraient toutes deux le test d'existence et créeraient deux tâches.
     *
     * @return {@code true} si l'événement doit être traité, {@code false} s'il a déjà été traité
     */
    public boolean firstTime(PlatformType platform, String eventId) {
        if (eventId == null || eventId.isBlank()) return true;
        String key = prefixFor(platform) + eventId;
        try {
            Boolean firstSight = redisTemplate.opsForValue().setIfAbsent(key, "1", SEEN_TTL);
            if (Boolean.FALSE.equals(firstSight)) {
                log.debug("[DEDUP] Événement déjà traité : {}", key);
                return false;
            }
            return true;
        } catch (Exception e) {
            // Redis down : fail-open, voir la note de classe.
            log.warn("[DEDUP] Redis indisponible ({}), événement traité sans marqueur : {}",
                e.getMessage(), key);
            return true;
        }
    }

    private static String prefixFor(PlatformType platform) {
        return platform == PlatformType.INSTAGRAM ? IG_SEEN_PREFIX : FB_SEEN_PREFIX;
    }
}