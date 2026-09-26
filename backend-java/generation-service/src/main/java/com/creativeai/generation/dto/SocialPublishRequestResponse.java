package com.creativeai.generation.dto;

import com.creativeai.generation.model.PublishStatus;
import com.creativeai.generation.social.SocialPlatform;

import java.time.LocalDateTime;

public record SocialPublishRequestResponse(
    String requestId,
    String jobId,
    int executionVersion,
    int outputIndex,
    SocialPlatform platform,
    String agentId,
    PublishStatus status,
    String caption,
    String remoteMediaId,
    String remotePermalink,
    GenerationJobResponse.ErrorInfo error,
    int attempts,
    LocalDateTime createdAt,
    LocalDateTime submittedAt,
    LocalDateTime publishedAt
) {}
