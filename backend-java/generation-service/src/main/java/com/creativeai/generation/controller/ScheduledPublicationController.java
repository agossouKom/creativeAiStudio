package com.creativeai.generation.controller;

import com.creativeai.generation.model.ScheduledPublication;
import com.creativeai.generation.model.ScheduledPublication.Status;
import com.creativeai.generation.service.ScheduledPublicationService;
import com.creativeai.generation.social.SocialPlatform;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Onglet Planning : programmer la diffusion d'une sortie générée.
 *
 * <p>Identifié par l'email de l'appelant, comme le reste du service : la
 * propriété est derivée du jeton, jamais d'un champ de la requête. Sans cela,
 * un utilisateur pourrait programmer la publication du média d'un autre en
 * devinant son {@code jobId}.
 */
@RestController
@RequestMapping("/api/scheduled-publications")
@RequiredArgsConstructor
@Tag(name = "Planning", description = "Publication différée d'un média généré")
public class ScheduledPublicationController {

    private final ScheduledPublicationService service;

    public record ScheduleRequest(
        @NotNull(message = "jobId est obligatoire")
        @Size(max = 64, message = "jobId ne doit pas dépasser 64 caractères")
        String jobId,

        @PositiveOrZero(message = "outputIndex doit être >= 0")
        int outputIndex,

        @NotNull(message = "platform est obligatoire")
        SocialPlatform platform,

        @NotNull(message = "agentId est obligatoire")
        @Size(max = 64, message = "agentId ne doit pas dépasser 64 caractères")
        String agentId,

        /** Légende telle qu'affichée dans la prévisualisation. */
        @Size(max = 2200, message = "La légende ne doit pas dépasser 2200 caractères")
        String caption,

        @NotNull(message = "scheduledAt est obligatoire")
        OffsetDateTime scheduledAt,

        /**
         * Optionnel : borne au plus tard la diffusion. Une programmation sans
         * fin est diffusée une seule fois ; une date de fin donne un délai
         * maximal ( utile pour « publier avant la fin de la semaine »), pas une
         * répétition quotidienne.
         */
        OffsetDateTime endAt
    ) {}

    @PostMapping
    @Operation(summary = "Programme une publication",
        description = "L'échéance est revalidée à l'exécution : ce qui était publiable "
            + "à la programmation peut ne plus l'être le jour venu (job relancé, "
            + "compte déconnecté).")
    public ResponseEntity<Map<String, Object>> schedule(
        @AuthenticationPrincipal String userEmail,
        @Valid @RequestBody ScheduleRequest request) {

        ScheduledPublication saved = service.schedule(ScheduledPublication.builder()
            .userEmail(userEmail)
            .jobId(request.jobId())
            .outputIndex(request.outputIndex())
            .platform(request.platform())
            .agentId(request.agentId())
            .caption(request.caption())
            .scheduledAt(request.scheduledAt())
            .endAt(request.endAt())
            .build());

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public ResponseEntity<Page<Map<String, Object>>> list(
        @AuthenticationPrincipal String userEmail,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size) {

        List<ScheduledPublication> content = service.listForUser(userEmail, page, size);
        return ResponseEntity.ok(new PageImpl<>(content.stream().map(this::toResponse).toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(
        @AuthenticationPrincipal String userEmail,
        @PathVariable long id) {
        return ResponseEntity.ok(toResponse(service.require(id, userEmail)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Annule une programmation",
        description = "Impossible une fois la diffusion lancée : l'issue serait inconnue "
            + "et l'annulation donnerait l'illusion que le post n'est pas parti.")
    public ResponseEntity<Map<String, Object>> cancel(
        @AuthenticationPrincipal String userEmail,
        @PathVariable long id) {
        return ResponseEntity.ok(toResponse(service.cancel(id, userEmail)));
    }

    @PostMapping("/{id}/retry")
    @Operation(summary = "Relance une programmation échouée ou expirée",
        description = "Après avoir corrigé la cause (compte reconnecté, job relancé…), "
            + "bascule la programmation en SCHEDULED et remet les tentatives à zéro. "
            + "Refusée si la diffusion est en cours ou déjà réussie.")
    public ResponseEntity<Map<String, Object>> retry(
        @AuthenticationPrincipal String userEmail,
        @PathVariable long id) {
        return ResponseEntity.ok(toResponse(service.retry(id, userEmail)));
    }

    /**
     * Sérialisation explicite plutôt que l'entité renvoyée telle quelle : on ne
     * veut pas exposer ni structure de table, ni champs ajoutés plus tard par
     * inadvertance.
     */
    private Map<String, Object> toResponse(ScheduledPublication entity) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", entity.getId());
        out.put("jobId", entity.getJobId());
        out.put("outputIndex", entity.getOutputIndex());
        out.put("platform", entity.getPlatform() != null ? entity.getPlatform().name() : null);
        out.put("agentId", entity.getAgentId());
        out.put("caption", entity.getCaption());
        out.put("scheduledAt", entity.getScheduledAt());
        out.put("endAt", entity.getEndAt());
        out.put("status", entity.getStatus() != null ? entity.getStatus().name() : null);
        out.put("attempts", entity.getAttempts());
        out.put("publishedCount", entity.getPublishedCount());
        out.put("lastErrorCode", entity.getLastErrorCode());
        out.put("lastError", entity.getLastError());
        out.put("firstRequestId", entity.getFirstRequestId());
        out.put("createdAt", entity.getCreatedAt());
        out.put("cancellable", isCancellable(entity.getStatus()));
        out.put("retryable", isRetryable(entity.getStatus()));
        return out;
    }

    private static boolean isCancellable(Status status) {
        return status == Status.SCHEDULED || status == Status.FAILED;
    }

    private static boolean isRetryable(Status status) {
        return status == Status.FAILED || status == Status.EXPIRED;
    }
}
