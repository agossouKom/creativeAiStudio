package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.service.ChannelSenderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Publication déclenchée par le planificateur de generation-service.
 *
 * <p>Pourquoi cette route existe : une publication programmée part à l'heure
 * dite, sans navigateur ouvert, donc sans jeton de session de l'utilisateur. Or
 * la route publique {@code POST /api/agents/{id}/posts} s'appuie sur ce jeton
 * pour prouver qui possède l'agent. Sans jeton, il n'y avait aucune façon
 * <em>légitime</em> de publier plus tard — d'où le contournement par des jetons
 * d user's stockés, que nous refusons.
 *
 * <p>Ce que ce point d'entrée garantit, et qui est le vrai contrôle de sécurité :
 *   • un secret partagé connu des seuls deux services internes ;
 *   • l'agent existe, n'est pas supprimé, et <b>appartient bien à l'email
 *     déclaré</b> — sans quoi n'importe quel planificateur qui.wrapperait le
 *     secret pourrait publier sur le compte d'un tiers ;
 *   • la publication passe par exactement le même code que la route publique
 *     (canal connecté, plateforme gérée, média présent).
 *
 * <p>Elle n'est volontairement pas routée par l'api-gateway : les services
 * n'ont pas de port exposé, et un {@code /internal/**} exposé par erreur
 * vaudrait une porte déverrouillée.
 */
@RestController
@RequestMapping("/internal/agents")
@RequiredArgsConstructor
public class InternalSocialPostController {

    private static final Logger log = LoggerFactory.getLogger(InternalSocialPostController.class);

    private final ChannelSenderService channelSenderService;
    private final AgentRepository agentRepository;
    private final SocialPostController socialPostController;

    /**
     * Secret partagé. Absent => le point d'entrée se refuse à répondre, plutôt
     * que d'accepter un appel non authentifié.
     */
    @Value("${agent.internal-service-token:}")
    private String serviceToken;

    public record InternalPostRequest(
        @NotBlank(message = "userEmail est obligatoire")
        String userEmail,

        @NotBlank(message = "platform est obligatoire")
        String platform,

        String content,

        List<String> mediaUrls
    ) {}

    @PostMapping("/{agentId}/posts")
    public ResponseEntity<ChannelSenderService.SendResult> publishScheduled(
        @PathVariable String agentId,
        @RequestHeader(value = "X-Internal-Token", required = false) String providedToken,
        @Valid @RequestBody InternalPostRequest request) {

        if (!tokenMatches(providedToken)) {
            log.warn("[INTERNAL_SOCIAL] Appel refusé : secret de service invalide (agent {})", agentId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ChannelSenderService.SendResult(false, null, "Secret de service invalide"));
        }

        Agent agent = agentRepository.findByIdAndDeletedFalse(agentId).orElse(null);
        if (agent == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ChannelSenderService.SendResult(false, null, "Agent introuvable"));
        }

        // C'est LE contrôle qui compte : le secret prouve qu'on est
        // generation-service, pas que l'agent appartient à l'utilisateur déclaré.
        if (!agent.getOwnerId().equalsIgnoreCase(request.userEmail())) {
            log.warn("[INTERNAL_SOCIAL] Refus : l'agent {} n'appartient pas à {}", agentId, request.userEmail());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ChannelSenderService.SendResult(false, null,
                    "L'agent indiqué n'appartient pas à cet utilisateur"));
        }

        log.info("[INTERNAL_SOCIAL] Publication planifiée agent={} user={} platform={}",
            agentId, request.userEmail(), request.platform());

        // On redescend le propriétaire stocké en base, et non l'email reçu dans
        // la requête : même après la comparaison, une identité fournie par le
        // client ne doit plus circuler. La casse ou un espace parasite dans
        // l'en-tête ne peut ainsi pas faire diverger la recherche de canaux de
        // l'identité réellement vérifiée.
        return socialPostController.publishAsUser(
            agent.getOwnerId(), agentId, request.platform(), request.content(), request.mediaUrls());
    }

    /**
     * Comparaison à temps constant : une égalité byte à byte laisse fuiter le
     * préfixe correct par la durée de la réponse.
     */
    private boolean tokenMatches(String provided) {
        if (serviceToken == null || serviceToken.isBlank() || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
            serviceToken.getBytes(StandardCharsets.UTF_8),
            provided.getBytes(StandardCharsets.UTF_8));
    }
}
