package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.enums.PlatformType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le webhook et le poller écrivent dans le même espace de clés : c'est ce qui
 * empêche un commentaire de créer deux tâches quand les deux mécanismes sont
 * activés en même temps — ce qui est le cas par défaut dans docker-compose.yml.
 *
 * <p>Sans marqueur partagé, activer le webhook « pour être plus réactif »
 * suffisait à doubler les réponses publiées : le webhook créait la tâche, et le
 * poller, qui continuait de tourner, créait la sienne.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WebhookEventDeduplicatorTest {

    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOps;

    private WebhookEventDeduplicator dedup;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        dedup = new WebhookEventDeduplicator(redisTemplate);
    }

    @Test
    @DisplayName("première livraison → à traiter ; les suivantes → déjà vues")
    void premiereLivraisonSeule() {
        when(valueOps.setIfAbsent(eq("fb:seen:c1"), anyString(), eq(Duration.ofDays(7))))
            .thenReturn(true, false);

        assertTrue(dedup.firstTime(PlatformType.FACEBOOK, "c1"));
        assertFalse(dedup.firstTime(PlatformType.FACEBOOK, "c1"));
    }

    @Test
    @DisplayName("l'écriture du marqueur est atomique (SET NX)")
    void ecritureAtomique() {
        // Un simple `hasKey` puis `set` laisserait passer deux livraisons
        // concurrentes du même commentaire — ce que Meta fait sur timeout —
        // et l'agent répondrait deux fois au même client.
        when(valueOps.setIfAbsent(anyString(), anyString(), eq(Duration.ofDays(7))))
            .thenReturn(true);

        assertTrue(dedup.firstTime(PlatformType.INSTAGRAM, "c1"));

        verify(redisTemplate, never()).hasKey(anyString());
        verify(valueOps).setIfAbsent("ig:seen:c1", "1", Duration.ofDays(7));
    }

    @Test
    @DisplayName("Facebook et Instagram n'utilisent pas le même espace de clés")
    void espacesSepares() {
        when(valueOps.setIfAbsent(anyString(), anyString(), eq(Duration.ofDays(7)))).thenReturn(true);

        assertTrue(dedup.firstTime(PlatformType.INSTAGRAM, "c1"));
        verify(valueOps).setIfAbsent(eq("ig:seen:c1"), anyString(), eq(Duration.ofDays(7)));
        verify(valueOps, never()).setIfAbsent(eq("fb:seen:c1"), anyString(), eq(Duration.ofDays(7)));
    }

    @Test
    @DisplayName("un identifiant vide n'est jamais dédoublonné")
    void identifiantVide() {
        // Un événement sans identifiant ne peut pas être dédoublonné : le
        // regrouper sous une même clé avalerait tous les suivants.
        assertTrue(dedup.firstTime(PlatformType.INSTAGRAM, null));
        assertTrue(dedup.firstTime(PlatformType.INSTAGRAM, "  "));
        verify(valueOps, never()).setIfAbsent(anyString(), anyString(), eq(Duration.ofDays(7)));
    }

    @Test
    @DisplayName("Redis indisponible → fail-open, l'événement est traité")
    void redisIndisponibleFailOpen() {
        // Choix assumé, inverse de WebhookVerifier : perdre un commentaire
        // client parce que Redis est tombé serait pire que d'en traiter un
        // en double.
        when(valueOps.setIfAbsent(anyString(), anyString(), eq(Duration.ofDays(7))))
            .thenThrow(new RedisConnectionFailureException("connexion refusée"));

        assertTrue(dedup.firstTime(PlatformType.INSTAGRAM, "c1"));
    }

    @Test
    @DisplayName("le marqueur est écrit avec un TTL de 7 jours")
    void ttlDuMarqueur() {
        when(valueOps.setIfAbsent(anyString(), anyString(), eq(Duration.ofDays(7)))).thenReturn(true);

        dedup.firstTime(PlatformType.INSTAGRAM, "c1");

        verify(valueOps).setIfAbsent(eq("ig:seen:c1"), eq("1"), eq(Duration.ofDays(7)));
    }
}