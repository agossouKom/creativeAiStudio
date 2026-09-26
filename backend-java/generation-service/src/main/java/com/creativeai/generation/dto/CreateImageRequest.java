package com.creativeai.generation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateImageRequest(
    @NotBlank(message = "prompt est obligatoire")
    @Size(max = 4000, message = "prompt ne doit pas dépasser 4000 caractères")
    String prompt,

    @Size(max = 2000, message = "negativePrompt ne doit pas dépasser 2000 caractères")
    String negativePrompt,

    ImageOptionsRequest options
) {
    public CreateImageRequest {
        if (options == null) {
            options = ImageOptionsRequest.defaults();
        }
    }
}
