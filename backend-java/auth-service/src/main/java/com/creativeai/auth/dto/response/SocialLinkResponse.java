package com.creativeai.auth.dto.response;

import com.creativeai.auth.model.SocialLink;

import java.time.LocalDateTime;

public record SocialLinkResponse(
        String id,
        String platform,
        String url,
        String iconClass,
        int    displayOrder,
        boolean isActive,
        SocialLink.OwnerType ownerType,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
