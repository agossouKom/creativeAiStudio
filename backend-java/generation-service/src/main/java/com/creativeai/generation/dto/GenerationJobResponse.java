package com.creativeai.generation.dto;

import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.MediaType;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.List;

public record GenerationJobResponse(
    String jobId,
    MediaType mediaType,
    JobStatus status,
    String stage,
    int progress,
    String prompt,
    String negativePrompt,
    JsonNode options,
    int executionVersion,
    String provider,
    String providerTaskId,
    ErrorInfo error,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime completedAt,
    List<GenerationOutputResponse> outputs
) {
    public record ErrorInfo(String code, String message) {}
}
