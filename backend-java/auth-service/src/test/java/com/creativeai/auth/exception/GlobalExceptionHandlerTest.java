package com.creativeai.auth.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verrouille le comportement du filet d'exceptions après le passage du
 * catch-all à un 500 sans détail.
 *
 * <p>Deux défauts historiques y sont couverts :
 * un refus {@code @PreAuthorize} renvoyait 500 au lieu de 403, et le corps du
 * 500 exposait {@code e.getMessage()} — un hôte MinIO, une requête ou une
 * classe interne pouvaient fuiter jusqu'au client.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("Un refus @PreAuthorize vaut 403 et non 500")
    void accessDeniedIsForbidden() {
        ResponseEntity<Map<String, String>> res =
                handler.handleAccessDenied(new AccessDeniedException("Access Denied"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res.getBody()).containsEntry("error", "Accès refusé");
    }

    @Test
    @DisplayName("Le refus d'accès n'est pas avalé par le catch-all")
    void accessDeniedIsNotSwallowedByTheGenericHandler() {
        AccessDeniedException ex = new AccessDeniedException("Access Denied");

        // Le catch-all est le filet qui transformait le refus en 500.
        ResponseEntity<Map<String, String>> generic = handler.handleGeneralException(ex);
        ResponseEntity<Map<String, String>> denied  = handler.handleAccessDenied(ex);

        assertThat(generic.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(denied.getStatusCode())
                .as("le handler dédié doit prendre le dessus sur le filet générique")
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("Le 500 n'expose pas le message de l'exception")
    void genericHandlerDoesNotLeakExceptionMessage() {
        ResponseEntity<Map<String, String>> res = handler.handleGeneralException(
                new RuntimeException("MinIO host=10.0.0.5 bucket=secret"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody())
                .as("aucune trace du message interne dans la réponse")
                .doesNotContainValue("MinIO host=10.0.0.5 bucket=secret")
                .containsEntry("error", "Une erreur interne est survenue");
    }

    @Test
    @DisplayName("IllegalStateException garde son message destiné à l'utilisateur")
    void illegalStateKeepsItsUserFacingMessage() {
        ResponseEntity<Map<String, String>> res = handler.handleIllegalState(
                new IllegalStateException("Aucune clé Groq configurée."));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody()).containsEntry("error", "Aucune clé Groq configurée.");
    }

    @Test
    @DisplayName("ResponseStatusException conserve le statut posé par le code")
    void responseStatusExceptionKeepsItsStatus() {
        ResponseEntity<Map<String, String>> res = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Objet introuvable"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(res.getBody()).containsEntry("error", "Objet introuvable");
    }
}
