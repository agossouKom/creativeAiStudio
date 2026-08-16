package com.creativeai.auth.dto.agent;
import java.time.LocalDateTime;
public record MemoryMessageDto(String id, String role, String content, String toolName, LocalDateTime createdAt) {}
