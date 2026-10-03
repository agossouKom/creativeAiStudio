package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * L'URL de webhook affichée à l'utilisateur doit pointer vers le contrôleur qui
 * sait traiter son type de payload.
 *
 * <p>Instagram avait une chaîne de traitement, mais la réponse exposait
 * {@code webhookUrl = null} : l'interface ne pouvait rien afficher, et copier
 * une URL Facebook sur la configuration Instagram se serait fait refuser en
 * silence ({@code object: "page"} rejeté par le contrôleur Instagram, et
 * l'inverse tout aussi).
 */
class ChannelResponseWebhookTest {

    private static final String PUBLIC_URL = "https://api.ai.labibpro.com";

    private static Channel channel(ChannelType type, PlatformType platform, String config) {
        Channel c = new Channel();
        c.setId("canal-1");
        c.setType(type);
        c.setPlatformType(platform);
        c.setConfig(config);
        return c;
    }

    @Test
    @DisplayName("Facebook → URL du contrôleur Page")
    void facebook() {
        ChannelResponse r = ChannelResponse.fromWithUrl(
            channel(ChannelType.SOCIAL_MEDIA, PlatformType.FACEBOOK, "{\"verifyToken\":\"uuid-fb\"}"),
            PUBLIC_URL);

        assertEquals(PUBLIC_URL + "/api/facebook/webhook/canal-1", r.webhookUrl());
        assertEquals("uuid-fb", r.verifyToken());
    }

    @Test
    @DisplayName("Instagram → URL du contrôleur Instagram, avec son verifyToken")
    void instagram() {
        ChannelResponse r = ChannelResponse.fromWithUrl(
            channel(ChannelType.SOCIAL_MEDIA, PlatformType.INSTAGRAM, "{\"verifyToken\":\"uuid-ig\"}"),
            PUBLIC_URL);

        assertEquals(PUBLIC_URL + "/api/instagram/webhook/canal-1", r.webhookUrl());
        assertEquals("uuid-ig", r.verifyToken());
    }

    @Test
    @DisplayName("config illisible → verifyToken nul plutôt qu'une valeur inventée")
    void configIllisible() {
        ChannelResponse r = ChannelResponse.fromWithUrl(
            channel(ChannelType.SOCIAL_MEDIA, PlatformType.INSTAGRAM, "{ pas du JSON"), PUBLIC_URL);

        assertEquals(PUBLIC_URL + "/api/instagram/webhook/canal-1", r.webhookUrl());
        assertNull(r.verifyToken());
    }

    @Test
    @DisplayName("plateforme sans webhook Meta → rien n'est exposé")
    void plateformeSansWebhook() {
        assertNull(ChannelResponse.fromWithUrl(
            channel(ChannelType.SOCIAL_MEDIA, PlatformType.TIKTOK, "{}"), PUBLIC_URL).webhookUrl());
        // Un canal Meta qui n'est pas « social media » n'a pas de webhook.
        assertNull(ChannelResponse.fromWithUrl(
            channel(ChannelType.WHATSAPP, PlatformType.FACEBOOK, "{}"), PUBLIC_URL).webhookUrl());
    }

    @Test
    @DisplayName("pas d'URL publique connue → URL nulle, mais jeton toujours transmis")
    void sansUrlPublique() {
        ChannelResponse r = ChannelResponse.from(
            channel(ChannelType.SOCIAL_MEDIA, PlatformType.INSTAGRAM, "{\"verifyToken\":\"uuid-ig\"}"));

        assertNull(r.webhookUrl());
        assertEquals("uuid-ig", r.verifyToken());
    }
}