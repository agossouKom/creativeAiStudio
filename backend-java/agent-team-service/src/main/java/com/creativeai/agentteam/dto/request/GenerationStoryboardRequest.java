package com.creativeai.agentteam.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerationStoryboardRequest(
    @NotBlank @Size(max = 8000) String prompt,
    @Min(1) @Max(60) int durationSeconds,
    @Size(max = 32) String language,
    @Min(1) @Max(10) int variations
) {}
