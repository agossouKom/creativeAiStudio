package com.creativeai.generation.dto;

import com.creativeai.generation.social.SocialPlatform;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PublishRequest(
    @NotNull(message = "platform est obligatoire")
    SocialPlatform platform,

    /** Agent dont les canaux connectés portent les credentials de la plateforme. */
    @Size(max = 64, message = "agentId ne doit pas dépasser 64 caractères")
    String agentId,

    @Size(max = 2200, message = "caption ne doit pas dépasser 2200 caractères")
    String caption
) {}
