package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.SocialPlatformRequest;
import com.creativeai.agentteam.dto.response.SocialAccountResponse;
import com.creativeai.agentteam.dto.response.SocialPlatformResponse;
import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Administration des réseaux sociaux — « Réseaux sociaux entreprise ».
 *
 * Deux responsabilités distinctes, et c'est volontaire :
 *   • `social_platforms`     → ce que la plateforme déclare aux réseaux
 *                              (identifiants de notre application, scopes) ;
 *   • `social-accounts`      → ce que les utilisateurs ont effectivement
 *                              autorisé, en lecture globale pour l'admin.
 *
 * La séparation permet d'ajouter un réseau sans migration, et évite d'exposer
 * les identifiants applicatifs à chaque utilisateur.
 *
 * Protection : `@PreAuthorize("hasRole('ADMIN')")`. Elle n'aurait rien fait
 * avant que le filtre lise le rôle du jeton et que `@EnableMethodSecurity` soit
 * activé — les deux sont corrigés et couverts par des tests.
 */
@RestController
@RequestMapping("/api/admin/social")
@RequiredArgsConstructor
@Tag(name = "Admin — Réseaux sociaux")
public class AdminSocialController {

    private static final Logger log = LoggerFactory.getLogger(AdminSocialController.class);

    private final SocialPlatformRepository platformRepository;
    private final UserSocialAccountRepository accountRepository;
    private final SocialPlatformConfigService configService;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    // ── Plateformes : CRUD complet ─────────────────────────────────────────

    @Operation(summary = "Lister les plateformes sociales et leur état de configuration")
    @GetMapping("/platforms")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<SocialPlatformResponse> list() {
        return platformRepository.findAllByOrderBySortOrderAsc().stream()
            .map(sp -> SocialPlatformResponse.from(
                sp,
                accountRepository.countByPlatform_IdAndDeletedFalse(sp.getId()),
                configService.resolve(sp.getId()).isPresent()))
            .toList();
    }

    @Operation(summary = "Créer ou modifier une plateforme")
    @PutMapping("/platforms/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> upsert(
            @PathVariable String id,
            @Valid @RequestBody SocialPlatformRequest request) {

        if (request.getId() != null && !request.getId().equalsIgnoreCase(id)) {
            return ResponseEntity.badRequest().body(Map.of("error",
                "L'identifiant du chemin et celui du corps diffèrent."));
        }

        // Les identifiants sont stockés en minuscules (seed + création). Sans cette
        // normalisation, PUT /platforms/TikTok ne trouverait pas la ligne
        // « tiktok » et créerait un doublon au lieu de la mettre à jour.
        final String platformId = id.toLowerCase();

        SocialPlatform sp = platformRepository.findById(platformId).orElseGet(() -> {
            SocialPlatform created = new SocialPlatform();
            created.setId(platformId);
            return created;
        });

        boolean isNew = sp.getDisplayName() == null;
        sp.setDisplayName(request.getDisplayName());
        if (request.getAuthType() != null && !request.getAuthType().isBlank()) {
            sp.setAuthType(request.getAuthType());
        }
        if (request.getClientId() != null) {
            sp.setClientId(request.getClientId().isBlank() ? null : request.getClientId());
        }
        // Écriture seule : un secret vide ne doit pas effacer celui en place,
        // sinon éditer un simple libellé casserait la connexion.
        if (request.getClientSecret() != null && !request.getClientSecret().isBlank()) {
            sp.setClientSecretEnc(encryptionService.encrypt(request.getClientSecret()));
        }
        if (request.getScopes() != null) {
            sp.setScopes(writeJson(request.getScopes()));
        }
        if (request.getTokenEndpoint() != null) {
            sp.setTokenEndpoint(blankToNull(request.getTokenEndpoint()));
        }
        if (request.getRefreshEndpoint() != null) {
            sp.setRefreshEndpoint(blankToNull(request.getRefreshEndpoint()));
        }
        if (request.getAccessTokenTtl() != null)   sp.setAccessTokenTtl(request.getAccessTokenTtl());
        if (request.getRefreshTokenTtl() != null)  sp.setRefreshTokenTtl(request.getRefreshTokenTtl());
        if (request.getExtraConfig() != null) {
            sp.setExtraConfig(blankToNull(request.getExtraConfig()) == null ? "{}" : request.getExtraConfig());
        }
        if (request.getIsActive() != null)   sp.setIsActive(request.getIsActive());
        if (request.getSortOrder() != null)  sp.setSortOrder(request.getSortOrder());

        SocialPlatform saved = platformRepository.save(sp);
        log.info("[ADMIN_SOCIAL] Plateforme {} {} par un administrateur", saved.getId(),
            isNew ? "créée" : "mise à jour");
        return ResponseEntity.ok(SocialPlatformResponse.from(saved,
            accountRepository.countByPlatform_IdAndDeletedFalse(saved.getId()),
            configService.resolve(saved.getId()).isPresent()));
    }

    @Operation(summary = "Activer ou désactiver une plateforme")
    @PatchMapping("/platforms/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> setActive(
            @PathVariable String id, @RequestParam boolean active) {

        SocialPlatform sp = platformRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Plateforme inconnue : " + id));

        // On refuse la désactivation d'une plateforme qui a déjà des comptes
        // rattachés : sinon ces comptes deviennent orphelins sans explication.
        if (!active) {
            long linked = accountRepository.countByPlatform_IdAndDeletedFalse(id);
            if (linked > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error",
                    "Impossible de désactiver : " + linked
                    + " compte(s) utilisateur sont rattachés à cette plateforme."));
            }
        }
        sp.setIsActive(active);
        platformRepository.save(sp);
        return ResponseEntity.ok(SocialPlatformResponse.from(sp,
            accountRepository.countByPlatform_IdAndDeletedFalse(id),
            configService.resolve(id).isPresent()));
    }

    @Operation(summary = "Supprimer une plateforme")
    @DeleteMapping("/platforms/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String id) {
        long linked = accountRepository.countByPlatform_IdAndDeletedFalse(id);
        if (linked > 0) {
            // La clé étrangère interdirait la suppression, mais un refus
            // explicite vaut mieux qu'une violation de contrainte incompréhensible.
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error",
                "Impossible de supprimer : " + linked
                + " compte(s) utilisateur sont rattachés à cette plateforme."));
        }
        if (!platformRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        platformRepository.deleteById(id);
        log.info("[ADMIN_SOCIAL] Plateforme {} supprimée", id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Révéler le secret applicatif d'une plateforme")
    @GetMapping("/platforms/{id}/reveal")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> reveal(@PathVariable String id) {
        var creds = configService.resolve(id);
        Map<String, Object> out = new LinkedHashMap<>();
        // Révéler est un acte volontaire et tracé : le dashboard n'appelle ce
        // point que sur clic explicite de l'administrateur.
        out.put("clientId", creds.clientId());
        out.put("fromDatabase", creds.fromDatabase());
        out.put("hasSecret", creds.clientSecret() != null && !creds.clientSecret().isBlank());
        log.warn("[ADMIN_SOCIAL] Révélation des identifiants de {} par un administrateur", id);
        return ResponseEntity.ok(out);
    }

    // ── Comptes utilisateurs : lecture globale ─────────────────────────────

    @Operation(summary = "Tous les comptes sociaux connectés, tous utilisateurs")
    @GetMapping("/accounts")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public Map<String, Object> accounts(
            @RequestParam(required = false) String platform,
            @RequestParam(required = false) String user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        String platformId = (platform == null || platform.isBlank())
            ? null : configService.resolvePlatformId(platform);
        String userId = (user == null || user.isBlank()) ? null : user;

        Page<com.creativeai.agentteam.model.UserSocialAccount> result =
            accountRepository.search(platformId, userId,
                PageRequest.of(Math.max(0, page), Math.min(200, Math.max(1, size))));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", result.getContent().stream().map(a -> SocialAccountResponse.builder()
            .id(a.getId())
            .userId(a.getUserId())
            .platformId(a.getPlatform() == null ? null : a.getPlatform().getId())
            .platformName(a.getPlatform() == null ? null : a.getPlatform().getDisplayName())
            .platformAccountId(a.getPlatformAccountId())
            .platformAccountName(a.getPlatformAccountName())
            .scopesGranted(a.grantedScopeList())
            .status(a.getStatus())
            .needsRefresh(Boolean.TRUE.equals(a.getNeedsRefresh()))
            .usable(a.isUsable())
            .tokenExpiresAt(a.getTokenExpiresAt())
            .connectedAt(a.getConnectedAt())
            .lastRefreshedAt(a.getLastRefreshedAt())
            .lastError(a.getLastError())
            .build()).toList());
        out.put("totalElements", result.getTotalElements());
        out.put("totalPages", result.getTotalPages());
        out.put("page", result.getNumber());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalConnected", accountRepository.countByDeletedFalse());
        stats.put("expiringSoon", accountRepository
            .countByNeedsRefreshTrueAndTokenExpiresAtBeforeAndDeletedFalse(
                java.time.LocalDateTime.now().plusHours(24)));
        out.put("stats", stats);
        return out;
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            // IllegalArgumentException tomberait dans le @ExceptionHandler
            // générique et deviendrait un 500 : on veut un 400 explicite.
            // Le message de Jackson n'est pas renvoyé : il peut reprendre le
            // fragment que l'admin vient d'envoyer.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "La liste de scopes n'est pas sérialisable en JSON.");
        }
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
