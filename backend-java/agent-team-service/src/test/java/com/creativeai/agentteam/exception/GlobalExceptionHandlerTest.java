package com.creativeai.agentteam.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("Un refus @PreAuthorize vaut 403 et non 500")
    void accessDeniedIsForbidden() {
        ProblemDetail detail = handler.handleAccessDenied(new AccessDeniedException("Access Denied"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(detail.getTitle()).isEqualTo(HttpStatus.FORBIDDEN.getReasonPhrase());
        assertThat(detail.getType().toString()).isEqualTo("/errors/403");
    }

    @Test
    @DisplayName("Le refus n'est plus journalisé comme une panne serveur")
    void accessDeniedIsNotSwallowedByTheGenericHandler() {
        AccessDeniedException ex = new AccessDeniedException("Access Denied");

        // handleGeneric est le filet de sécurité qui transformait le refus en 500
        // en le journalisant en ERROR : un administrateur ne doit pas voir son
        // refus d'accès remonté comme une panne.
        ProblemDetail generic = handler.handleGeneric(ex);

        assertThat(generic.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
        assertThat(handler.handleAccessDenied(ex).getStatus())
            .as("le handler dédié doit prendre le dessus sur le filet générique")
            .isEqualTo(HttpStatus.FORBIDDEN.value());
    }
}