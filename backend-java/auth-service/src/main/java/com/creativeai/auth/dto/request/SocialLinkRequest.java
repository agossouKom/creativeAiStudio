package com.creativeai.auth.dto.request;

import com.creativeai.auth.model.SocialLink;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SocialLinkRequest(
        @NotBlank @Size(min = 2, max = 100) String platform,
        @NotBlank @Size(max = 500)          String url,
        @NotBlank @Size(max = 100)          String iconClass,
        Integer  displayOrder,
        Boolean  isActive,
        @NotNull SocialLink.OwnerType ownerType
) {}
