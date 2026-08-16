package com.creativeai.auth.dto.gmail;

import java.util.List;

/**
 * Normalized email DTO sent to the Angular frontend.
 * Built from the raw Gmail API message format.
 */
public record GmailEmailDto(
    String id,
    String threadId,
    String from,
    String fromEmail,
    String to,
    String subject,
    String snippet,
    String body,
    String date,
    String dateRaw,
    boolean read,
    boolean hasAttachment,
    List<String> labels
) {}
