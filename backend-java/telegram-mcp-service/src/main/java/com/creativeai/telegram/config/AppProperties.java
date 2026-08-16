package com.creativeai.telegram.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
    String agentTeamBaseUrl,
    String authServiceBaseUrl,
    String jwtSecret,
    Telegram telegram
) {
    public record Telegram(
        String botToken,
        String botName,
        /** URL publique HTTPS du webhook (ex: https://myapp.com/telegram/webhook).
         *  Vide = mode long-polling (défaut dev). */
        String webhookUrl,
        /** Secret optionnel vérifié dans X-Telegram-Bot-Api-Secret-Token. */
        String webhookSecret
    ) {}
}
