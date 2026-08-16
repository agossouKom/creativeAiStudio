package com.creativeai.rag.model;

/**
 * Response returned after ingesting a document.
 */
public record IngestResponse(
        String filename,
        int chunksCreated,
        String status,
        String detail
) {}
