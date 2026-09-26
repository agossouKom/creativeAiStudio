package com.creativeai.generation.exception;

import org.springframework.http.HttpStatus;

/**
 * La plateforme a répondu en erreur (ou est injoignable) : la demande est
 * enregistrée en FAILED, puis l'appelant reçoit un 502.
 */
public class PlatformApiException extends RuntimeException {

    private final String code;

    public PlatformApiException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus status() {
        return HttpStatus.BAD_GATEWAY;
    }
}
