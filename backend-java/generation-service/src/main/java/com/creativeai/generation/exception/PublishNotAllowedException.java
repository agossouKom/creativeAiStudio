package com.creativeai.generation.exception;

import org.springframework.http.HttpStatus;

public class PublishNotAllowedException extends RuntimeException {

    private final String code;

    public PublishNotAllowedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus status() {
        return HttpStatus.CONFLICT;
    }
}
