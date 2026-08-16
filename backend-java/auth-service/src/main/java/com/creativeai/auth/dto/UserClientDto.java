package com.creativeai.auth.dto;

public record UserClientDto(
    String id,
    String code, String nom, String prenoms,
    String contact, String email, String entrepriseName,
    boolean deleted
) {}
