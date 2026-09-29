package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.service.ChannelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

/**
 * Publication sociale d'un média déjà stocké, appelée par generation-service.
 *
 * Le service reste propriétaire des credentials Meta chiffrés et des adaptateurs
 * Graph API : ce contrôleur ne fait qu'un pont. Il refuse explicitement ce que
 * ChannelSenderService ne sait pas faire réellement (plateforme sans adaptateur,
 * agent sans canal connecté) au lieu de renvoyer un succès factice.
 */
@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
@Tag(name = "Publication sociale", description = "Publie un média stocké (MinIO ou URL) sur un réseau social")
public class SocialPostController {

    /** Adaptateurs réellement implémentés dans ChannelSenderService. */
    private static final Set<PlatformType> SUPPORTED_PLATFORMS =
        Set.of(PlatformType.FACEBOOK, PlatformType.INSTAGRAM);

    private final ChannelSenderService channelSenderService;
    private final ChannelService channelService;

    public record SocialPostRequest(
        @NotNull(message = "platform est obligatoire")
        String platform,

        String content,

        @Size(max = 4, message = "mediaUrls ne doit pas contenir plus de 4 médias")
        List<String> mediaUrls
    ) {}

    @PostMapping("/{agentId}/posts")
    @Operation(
        summary = "Publie sur Facebook ou Instagram",
        description = """
            Formats de média acceptés dans `mediaUrls` :
            - `minio://<objectKey>` : objet du bucket par défaut de l'agent ;
            - `http(s)://...` : URL publique, ou URL MinIO (téléchargement cross-bucket
              puis upload binaire pour Facebook).

            Seuls Facebook et Instagram sont publiés réellement, et uniquement si
            l'agent possède un canal CONNECTED pour cette plateforme : sinon 400,
            jamais un succès simulé.
            """)
    public ResponseEntity<ChannelSenderService.SendResult> publish(
        @PathVariable String agentId,
        @AuthenticationPrincipal String userId,
        @Valid @RequestBody SocialPostRequest request) {
        return publishAsUser(userId, agentId, request.platform(), request.content(), request.mediaUrls());
    }

    /**
     * Point d'entrée unique de la publication. Les deux appelants — l'utilisateur
     * connecté et le déclencheur de programming — passent par ici : le chemin
     * interne ne doit jamais devenir un raccourci qui_encoderait une vérification
     * (canal connecté, média présent, plateforme gérée) que l'utilisateur, lui,
     * devrait passer.
     */
    public ResponseEntity<ChannelSenderService.SendResult> publishAsUser(
        String userId, String agentId, String rawPlatform,
        String rawContent, List<String> rawMediaUrls) {

        PlatformType platform = resolvePlatform(rawPlatform);
        if (platform == null) {
            return ResponseEntity.badRequest().body(new ChannelSenderService.SendResult(false, null,
                "Plateforme non prise en charge par agent-team-service: " + rawPlatform
                    + ". Adaptateurs disponibles: " + SUPPORTED_PLATFORMS));
        }

        String content = rawContent == null ? "" : rawContent;
        List<String> mediaUrls = rawMediaUrls == null ? List.of() : rawMediaUrls;
        if (content.isBlank() && mediaUrls.isEmpty()) {
            return ResponseEntity.badRequest().body(new ChannelSenderService.SendResult(false, null,
                "Un contenu texte ou au moins un média est requis"));
        }

        boolean connected = channelService.listChannels(userId, agentId).stream()
            .anyMatch(channel -> channel.platformType() == platform
                && channel.status() == ChannelStatus.CONNECTED);
        if (!connected) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ChannelSenderService.SendResult(false, null,
                    "Aucun canal " + platform + " CONNECTED pour l'agent " + agentId
                        + ": connectez le compte avant de publier."));
        }

        return ResponseEntity.ok(
            channelSenderService.postSocial(userId, agentId, platform.name(), content, mediaUrls));
    }

    private PlatformType resolvePlatform(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().toUpperCase().replace('-', '_');
        PlatformType platform;
        try {
            platform = PlatformType.valueOf(value);
        } catch (IllegalArgumentException e) {
            // "X" est ambigu côté API : PlatformType attend TWITTER_X
            return "X".equals(value) ? PlatformType.TWITTER_X : null;
        }
        return SUPPORTED_PLATFORMS.contains(platform) ? platform : null;
    }
}
