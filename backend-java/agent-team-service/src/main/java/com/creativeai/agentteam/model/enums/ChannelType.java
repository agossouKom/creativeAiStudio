package com.creativeai.agentteam.model.enums;

public enum ChannelType {
    // Email
    GMAIL, EMAIL_SMTP,
    // Messaging
    WHATSAPP, TELEGRAM, SLACK,
    // Social media (detail via PlatformType)
    SOCIAL_MEDIA,
    // Outils internes / stockage
    ONLY_OFFICE, RXRESUME, MINIO,
    // Providers IA
    IMAGE_PROVIDER, VIDEO_PROVIDER,
    // Intégrations
    WEBHOOK, CRM,
    // Communication interne agent → patron (inbox livraison)
    AGENT_INTERNAL
}
