package com.creativeai.rag.model;

import java.util.List;

/**
 * Chat message returned from the non-streaming endpoint.
 */
public record ChatMessage(
        String role,
        String content,
        List<String> sources
) {}
