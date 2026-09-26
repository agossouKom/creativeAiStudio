package com.creativeai.generation.controller;

import com.creativeai.generation.dto.PublishRequest;
import com.creativeai.generation.dto.SocialPlatformResponse;
import com.creativeai.generation.dto.SocialPublishRequestResponse;
import com.creativeai.generation.service.SocialPublishService;
import com.creativeai.generation.social.SocialPlatformRegistry;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/generation")
@RequiredArgsConstructor
@Tag(name = "Publication sociale", description = "Publication d'une sortie générée sur les réseaux sociaux")
public class SocialPublishController {

    private final SocialPublishService publishService;
    private final SocialPlatformRegistry registry;

    @GetMapping("/social/platforms")
    @Operation(summary = "Plateformes sociales et leurs contraintes réelles")
    public List<SocialPlatformResponse> platforms() {
        return registry.all().stream().map(SocialPlatformResponse::from).toList();
    }

    @PostMapping("/jobs/{jobId}/outputs/{index}/publish")
    @Operation(summary = "Publie une sortie générée (Facebook / Instagram disponibles)")
    public ResponseEntity<SocialPublishRequestResponse> publish(@PathVariable String jobId,
                                                               @PathVariable int index,
                                                               @Valid @RequestBody PublishRequest request,
                                                               Authentication authentication,
                                                               HttpServletRequest httpRequest) {
        return ResponseEntity.ok(
            publishService.publish(jobId, index, user(authentication), request, bearerToken(httpRequest)));
    }

    @GetMapping("/social/requests")
    @Operation(summary = "Historique des publications de l'utilisateur")
    public List<SocialPublishRequestResponse> list(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size,
                                                   Authentication authentication) {
        return publishService.toResponses(
            publishService.list(user(authentication), page, size).getContent());
    }

    @GetMapping("/social/requests/{requestId}")
    @Operation(summary = "Détail d'une demande de publication")
    public SocialPublishRequestResponse get(@PathVariable String requestId, Authentication authentication) {
        return publishService.get(requestId, user(authentication));
    }

    @GetMapping("/jobs/{jobId}/social/requests")
    @Operation(summary = "Publications liées à un job")
    public List<SocialPublishRequestResponse> forJob(@PathVariable String jobId,
                                                     Authentication authentication) {
        return publishService.toResponses(publishService.listForJob(jobId, user(authentication)));
    }

    @PostMapping("/social/requests/{requestId}/retry")
    @Operation(summary = "Relance une demande de publication échouée (3 tentatives maximum)")
    public ResponseEntity<SocialPublishRequestResponse> retry(@PathVariable String requestId,
                                                              Authentication authentication,
                                                              HttpServletRequest httpRequest) {
        return ResponseEntity.ok(
            publishService.retry(requestId, user(authentication), bearerToken(httpRequest)));
    }

    private String user(Authentication authentication) {
        return authentication != null ? authentication.getName() : "anonymous";
    }

    /** Jeton de l'appelant, relayé vers agent-team-service qui vérifie la propriété des canaux. */
    private String bearerToken(HttpServletRequest request) {
        String header = request != null ? request.getHeader(HttpHeaders.AUTHORIZATION) : null;
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        return header.substring(7).trim();
    }
}
