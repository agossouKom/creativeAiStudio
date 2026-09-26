package com.creativeai.generation.social;

import com.creativeai.generation.model.MediaType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Matrice de capacités sociales : ce que chaque plateforme accepte réellement.
 *
 * Seuls Facebook et Instagram sont {@link SupportLevel#LIVE} : leurs adaptateurs
 * Meta Graph vivent dans agent-team-service (channels chiffrés, webhooks, pollers)
 * et la publication y est déléguée. Les autres plateformes sont
 * {@link SupportLevel#PLANNED} tant qu'aucun adaptateur n'est écrit.
 */
@Component
public class SocialPlatformRegistry {

    private final Map<SocialPlatform, PlatformCapabilities> capabilities =
        new EnumMap<>(SocialPlatform.class);

    public SocialPlatformRegistry() {
        // ── Plateformes LIVE : adaptateur Meta Graph dans agent-team-service ──────

        register(builder()
            .platform(SocialPlatform.FACEBOOK)
            .label("Facebook")
            .supportLevel(SupportLevel.LIVE)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.MINIO_URL)
            .requiresProfessionalAccount(true)
            .requiresAppReview(true)
            .requiredScopes(List.of("pages_show_list", "pages_read_engagement",
                "pages_manage_posts", "pages_manage_video_posts"))
            .maxDurationSeconds(14400)
            .allowedAspectRatios(List.of("16:9", "9:16", "1:1", "4:5"))
            .notes("Publication déléguée à agent-team-service (Graph API) sur une Page liée. "
                + "Le média est téléchargé par nos soins puis uploadé en binaire : "
                + "aucune URL publique n'est nécessaire.")
            .build());

        register(builder()
            .platform(SocialPlatform.INSTAGRAM)
            .label("Instagram")
            .supportLevel(SupportLevel.LIVE)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.PRESIGNED_URL)
            .requiresProfessionalAccount(true)
            .requiresAppReview(true)
            .requiredScopes(List.of("instagram_basic", "instagram_content_publish",
                "pages_show_list", "pages_read_engagement"))
            .maxDurationSeconds(900)
            .allowedAspectRatios(List.of("9:16", "1:1", "4:5"))
            .notes("Publication déléguée à agent-team-service (Instagram Graph API) : compte "
                + "Business/Créateur lié à une Page, vidéo en REEL. Meta doit télécharger "
                + "le média : URL MinIO signée obligatoire.")
            .build());

        // ── Plateformes prévues : aucun adaptateur, publication refusée ─────────

        register(builder()
            .platform(SocialPlatform.TIKTOK)
            .label("TikTok")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO))
            .mediaReference(MediaReference.PRESIGNED_URL)
            .requiresProfessionalAccount(false)
            .requiresAppReview(true)
            .requiredScopes(List.of("user.info.basic", "video.publish"))
            .maxDurationSeconds(600)
            .allowedAspectRatios(List.of("9:16", "1:1", "16:9"))
            .notes("Content Posting API : audit TikTok obligatoire, aucune publication "
                + "directe possible avant validation de l'application. Vidéo uniquement.")
            .build());

        register(builder()
            .platform(SocialPlatform.YOUTUBE)
            .label("YouTube")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO))
            .mediaReference(MediaReference.BYTES_UPLOAD)
            .requiresProfessionalAccount(false)
            .requiresAppReview(true)
            .requiredScopes(List.of("youtube.upload"))
            .maxDurationSeconds(43200)
            .allowedAspectRatios(List.of("16:9", "9:16", "1:1"))
            .notes("Data API v3 videos.insert : upload des octets (Shorts = vidéo "
                + "verticale). Quota d'upload journalier limité sur les projets non vérifiés.")
            .build());

        register(builder()
            .platform(SocialPlatform.THREADS)
            .label("Threads")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.PRESIGNED_URL)
            .requiresProfessionalAccount(false)
            .requiresAppReview(true)
            .requiredScopes(List.of("threads_basic", "threads_content_publish"))
            .maxDurationSeconds(300)
            .allowedAspectRatios(List.of("9:16", "1:1", "16:9"))
            .notes("Threads API : publication texte + média via URL publique, contenu "
                + "soumis à modération.")
            .build());

        register(builder()
            .platform(SocialPlatform.TWITTER_X)
            .label("X")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.BYTES_UPLOAD)
            .requiresProfessionalAccount(false)
            .requiresAppReview(true)
            .requiredScopes(List.of("tweet.read", "tweet.write", "users.read", "media.write"))
            .maxDurationSeconds(140)
            .allowedAspectRatios(List.of("16:9", "9:16", "1:1"))
            .notes("API v2 : upload média par chunks (media.upload) puis tweet. "
                + "Les comptes gratuits ont des quotas de publication très bas.")
            .build());

        register(builder()
            .platform(SocialPlatform.LINKEDIN)
            .label("LinkedIn")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.BYTES_UPLOAD)
            .requiresProfessionalAccount(false)
            .requiresAppReview(false)
            .requiredScopes(List.of("w_member_social", "w_organization_social"))
            .maxDurationSeconds(600)
            .allowedAspectRatios(List.of("16:9", "1:1", "4:5"))
            .notes("API Marketing : ugcPosts pour les membres, Video/Image API pour les "
                + "pages d'organisation reliées à une Page Meta.")
            .build());

        register(builder()
            .platform(SocialPlatform.PINTEREST)
            .label("Pinterest")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.PRESIGNED_URL)
            .requiresProfessionalAccount(true)
            .requiresAppReview(true)
            .requiredScopes(List.of("pins:read", "boards:pin", "user_accounts:read"))
            .maxDurationSeconds(300)
            .allowedAspectRatios(List.of("2:3", "9:16", "1:1"))
            .notes("Pins API v5 : les URL d'image doivent être indexables et servir une "
                + "image haute résolution en HTTPS.")
            .build());

        register(builder()
            .platform(SocialPlatform.SNAPCHAT)
            .label("Snapchat")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.PRESIGNED_URL)
            .requiresProfessionalAccount(true)
            .requiresAppReview(true)
            .requiredScopes(List.of("creative.manage", "profile.read"))
            .maxDurationSeconds(60)
            .allowedAspectRatios(List.of("9:16", "1:1"))
            .notes("Marketing API : publication unitaire uniquement (pas de carousel) "
                + "et compte Public Profile obligatoire.")
            .build());

        register(builder()
            .platform(SocialPlatform.TELEGRAM)
            .label("Telegram")
            .supportLevel(SupportLevel.PLANNED)
            .supportedMedia(Set.of(MediaType.VIDEO, MediaType.IMAGE))
            .mediaReference(MediaReference.BYTES_UPLOAD)
            .requiresProfessionalAccount(false)
            .requiresAppReview(false)
            .requiredScopes(List.of("bot_token"))
            .maxDurationSeconds(3600)
            .allowedAspectRatios(List.of("16:9", "9:16", "1:1", "4:5"))
            .notes("telegram-mcp-service sait déjà envoyer des médias, mais aucun pont "
                + "vers ce service n'est encore branché : publication refusée pour l'instant.")
            .build());
    }

    private void register(PlatformCapabilities capabilities) {
        this.capabilities.put(capabilities.platform(), capabilities);
    }

    public PlatformCapabilities get(SocialPlatform platform) {
        PlatformCapabilities found = capabilities.get(platform);
        if (found == null) {
            throw new IllegalArgumentException("Plateforme sociale inconnue: " + platform);
        }
        return found;
    }

    public List<PlatformCapabilities> all() {
        return List.copyOf(capabilities.values());
    }

    private static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private SocialPlatform platform;
        private String label;
        private SupportLevel supportLevel;
        private Set<MediaType> supportedMedia = Set.of();
        private MediaReference mediaReference = MediaReference.PRESIGNED_URL;
        private boolean requiresProfessionalAccount;
        private boolean requiresAppReview;
        private List<String> requiredScopes = List.of();
        private Integer maxDurationSeconds;
        private List<String> allowedAspectRatios = List.of();
        private String notes = "";

        public Builder platform(SocialPlatform platform) {
            this.platform = platform;
            return this;
        }

        public Builder label(String label) {
            this.label = label;
            return this;
        }

        public Builder supportLevel(SupportLevel supportLevel) {
            this.supportLevel = supportLevel;
            return this;
        }

        public Builder supportedMedia(Set<MediaType> supportedMedia) {
            this.supportedMedia = supportedMedia;
            return this;
        }

        public Builder mediaReference(MediaReference mediaReference) {
            this.mediaReference = mediaReference;
            return this;
        }

        public Builder requiresProfessionalAccount(boolean requiresProfessionalAccount) {
            this.requiresProfessionalAccount = requiresProfessionalAccount;
            return this;
        }

        public Builder requiresAppReview(boolean requiresAppReview) {
            this.requiresAppReview = requiresAppReview;
            return this;
        }

        public Builder requiredScopes(List<String> requiredScopes) {
            this.requiredScopes = requiredScopes;
            return this;
        }

        public Builder maxDurationSeconds(Integer maxDurationSeconds) {
            this.maxDurationSeconds = maxDurationSeconds;
            return this;
        }

        public Builder allowedAspectRatios(List<String> allowedAspectRatios) {
            this.allowedAspectRatios = allowedAspectRatios;
            return this;
        }

        public Builder notes(String notes) {
            this.notes = notes;
            return this;
        }

        public PlatformCapabilities build() {
            if (platform == null || supportLevel == null || mediaReference == null) {
                throw new IllegalStateException("platform, supportLevel et mediaReference sont obligatoires");
            }
            return new PlatformCapabilities(platform,
                label != null ? label : platform.name(),
                supportLevel,
                Set.copyOf(supportedMedia),
                mediaReference,
                requiresProfessionalAccount,
                requiresAppReview,
                List.copyOf(requiredScopes),
                maxDurationSeconds,
                List.copyOf(allowedAspectRatios),
                notes);
        }
    }
}
