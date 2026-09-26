package com.creativeai.generation.social;

import com.creativeai.generation.model.MediaType;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SocialPlatformRegistryTest {

    private final SocialPlatformRegistry registry = new SocialPlatformRegistry();

    @Test
    void everyPlatformIsDeclared() {
        assertEquals(SocialPlatform.values().length, registry.all().size());
        for (SocialPlatform platform : SocialPlatform.values()) {
            assertEquals(platform, registry.get(platform).platform());
        }
    }

    @Test
    void onlyMetaPlatformsAreLive() {
        Set<SocialPlatform> live = new HashSet<>();
        for (PlatformCapabilities capabilities : registry.all()) {
            if (capabilities.supportLevel() == SupportLevel.LIVE) {
                live.add(capabilities.platform());
            }
        }
        assertEquals(Set.of(SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM), live);
    }

    @Test
    void instagramNeedsAPublicMediaUrlBecauseMetaFetchesIt() {
        PlatformCapabilities instagram = registry.get(SocialPlatform.INSTAGRAM);
        assertTrue(instagram.requiresPublicMediaUrl());
        assertEquals(MediaReference.PRESIGNED_URL, instagram.mediaReference());
        assertTrue(instagram.requiresProfessionalAccount());
        assertTrue(instagram.accepts(MediaType.IMAGE));
        assertTrue(instagram.accepts(MediaType.VIDEO));
    }

    @Test
    void facebookIsUploadedAsBinarySoNoPublicUrlIsNeeded() {
        PlatformCapabilities facebook = registry.get(SocialPlatform.FACEBOOK);
        assertFalse(facebook.requiresPublicMediaUrl());
        assertEquals(MediaReference.MINIO_URL, facebook.mediaReference());
    }

    @Test
    void tiktokIsVideoOnlyAndPendingAppReview() {
        PlatformCapabilities tiktok = registry.get(SocialPlatform.TIKTOK);
        assertEquals(SupportLevel.PLANNED, tiktok.supportLevel());
        assertTrue(tiktok.accepts(MediaType.VIDEO));
        assertFalse(tiktok.accepts(MediaType.IMAGE));
        assertTrue(tiktok.requiresAppReview());
    }

    @Test
    void durationLimitsAreEnforced() {
        assertTrue(registry.get(SocialPlatform.INSTAGRAM).acceptsDuration(900));
        assertFalse(registry.get(SocialPlatform.INSTAGRAM).acceptsDuration(901));
        assertTrue(registry.get(SocialPlatform.SNAPCHAT).acceptsDuration(60));
        assertFalse(registry.get(SocialPlatform.SNAPCHAT).acceptsDuration(61));
    }

    @Test
    void plannedPlatformsDocumentTheirRequirements() {
        for (PlatformCapabilities capabilities : registry.all()) {
            assertFalse(capabilities.requiredScopes().isEmpty(), capabilities.platform() + " sans scopes");
            assertFalse(capabilities.notes().isBlank(), capabilities.platform() + " sans note");
            assertTrue(capabilities.maxDurationSeconds() != null && capabilities.maxDurationSeconds() > 0,
                capabilities.platform() + " sans durée maximale");
        }
    }

    @Test
    void youtubeUsesDirectByteUpload() {
        assertEquals(MediaReference.BYTES_UPLOAD, registry.get(SocialPlatform.YOUTUBE).mediaReference());
        assertEquals(MediaReference.BYTES_UPLOAD, registry.get(SocialPlatform.TWITTER_X).mediaReference());
    }

    @Test
    void unknownPlatformIsRejected() {
        assertThrowsIllegalArgument(registry);
    }

    private void assertThrowsIllegalArgument(SocialPlatformRegistry registryUnderTest) {
        try {
            registryUnderTest.get(null);
            throw new AssertionError("Une plateforme nulle doit être refusée");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("inconnue"));
        }
    }
}
