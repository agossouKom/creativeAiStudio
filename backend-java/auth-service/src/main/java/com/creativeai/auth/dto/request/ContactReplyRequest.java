package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactReplyRequest(
    @NotBlank String sujet,
    @NotBlank @Size(max = 3000) String message
) {}
