package com.creativeai.rag.model;

/**
 * Incoming chat request payload.
 */
public record ChatRequest(
        String question,
        String conversationId
) {}
