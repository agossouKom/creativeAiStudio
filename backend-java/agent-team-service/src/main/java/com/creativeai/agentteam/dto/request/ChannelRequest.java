package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ChannelRequest(
    @NotNull ChannelType type,
    PlatformType platformType,
    @NotBlank String displayName,
    String credentials,
    String config,
    String accountId,
    String accountName
) {}
