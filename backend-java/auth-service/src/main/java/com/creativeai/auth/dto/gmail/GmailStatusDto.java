package com.creativeai.auth.dto.gmail;

/**
 * Gmail connection status returned to the frontend.
 */
public record GmailStatusDto(
    boolean connected,
    String gmailEmail,
    String connectedAt
) {}
