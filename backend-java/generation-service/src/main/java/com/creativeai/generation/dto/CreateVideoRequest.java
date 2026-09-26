package com.creativeai.generation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateVideoRequest(
    @NotBlank(message = "prompt est obligatoire")
    @Size(max = 8000, message = "prompt ne doit pas dépasser 8000 caractères")
    String prompt,

    VideoOptionsRequest options,

    @Size(max = 64, message = "agentId ne doit pas dépasser 64 caractères")
    String agentId
) {
    public CreateVideoRequest {
        if (options == null) {
            options = VideoOptionsRequest.defaults();
        }
    }

    public CreateVideoRequest(String prompt, VideoOptionsRequest options) {
        this(prompt, options, null);
    }
}
