package com.creativeai.auth.dto.gmail;

public record GmailSendRequest(
    String to,
    String subject,
    String body,
    String threadId   // null for new email, non-null to reply in thread
) {}
