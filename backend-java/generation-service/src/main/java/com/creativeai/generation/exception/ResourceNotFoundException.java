package com.creativeai.generation.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException of(String what, String id) {
        return new ResourceNotFoundException(what + " introuvable: " + id);
    }

    public HttpStatus status() {
        return HttpStatus.NOT_FOUND;
    }
}
