package com.creativeai.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginOtpRequest(
    @NotBlank String email,
    @NotBlank String password,
    @NotBlank String otpCode
) {}
