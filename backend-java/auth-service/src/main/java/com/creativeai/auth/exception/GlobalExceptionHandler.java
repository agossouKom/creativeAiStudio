package com.creativeai.auth.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(org.springframework.web.bind.MethodArgumentNotValidException ex) {
        Map<String, String> errors = new java.util.HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((org.springframework.validation.FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(org.springframework.security.authentication.BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentialsException(org.springframework.security.authentication.BadCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage(), "message", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "message", e.getMessage()));
    }

    /**
     * Refus d'autorisation issu de {@code @PreAuthorize} → 403, et non 500.
     *
     * <p>Sans ce handler, l'{@code AccessDeniedException} tombe dans
     * {@link #handleGeneralException} : un utilisateur non administrateur
     * atteignant une route d'administration obtenait une erreur serveur au
     * lieu d'un refus explicite. C'est trompeur — la réponse laisse croire à
     * une panne alors que la décision de sécurité a été prise correctement —
     * et ça masque ces refus dans les journaux d'alerte.
     *
     * <p>Le message de l'exception n'est pas renvoyé : il provient du cadre
     * de sécurité, pas de l'application.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException e) {
        log.info("Accès refusé : {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Accès refusé", "message", "Accès refusé"));
    }

    /**
     * État métier violé → 409, avec son message : celui-ci est rédigé pour
     * l'utilisateur (« Trop de connexions Gmail en cours », « Aucune clé Groq
     * configurée »). Sans ce handler, il serait avalé par le catch-all et perdu
     * puisque celui-ci ne expose plus le détail de l'exception.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", e.getMessage(), "message", e.getMessage()));
    }

    /**
     * Statut explicite posé par le code applicatif → on respecte ce statut au
     * lieu de le convertir en 500 par le catch-all.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        HttpStatus resolved = status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
        String reason = e.getReason() != null ? e.getReason() : resolved.getReasonPhrase();
        return ResponseEntity.status(resolved).body(Map.of("error", reason, "message", reason));
    }

    /**
     * Filet générique : 500 sans détail. Le message de l'exception n'est pas
     * renvoyé au client — il peut contenir un hôte MinIO, une requête SQL ou un
     * nom de classe interne. Il est journalisé en ERROR à la place.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception e) {
        log.error("Unhandled exception", e);
        String message = "Une erreur interne est survenue";
        return ResponseEntity.internalServerError()
                .body(Map.of("error", message, "message", message));
    }
}
