package com.creativeai.agentteam.util;

import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskType;
import lombok.experimental.UtilityClass;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;

/**
 * Parse le format structuré de tâche envoyé via WhatsApp ou Telegram :
 *
 * Titre: Mon titre
 * Contacts: jean@example.com, +33612345678
 * Description: Description détaillée
 * Équipe: Marketing
 * Type: EMAIL_RESPONSE
 * Priorité: HIGH
 * Date limite: 2025-12-31T18:00
 * Confidentialité: oui
 * Résultat attendu: Un email rédigé et envoyé
 * Pièces jointes: https://...
 */
@UtilityClass
public class MessagingTaskParser {

    private static final DateTimeFormatter[] DATE_FORMATS = {
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        DateTimeFormatter.ISO_LOCAL_DATE_TIME,
        DateTimeFormatter.ISO_LOCAL_DATE
    };

    public record ParsedTask(
        String title,
        String description,
        String contacts,
        String team,
        TaskType taskType,
        Priority priority,
        LocalDateTime dueDate,
        boolean confidential,
        String expectedResult,
        String attachments
    ) {}

    public ParsedTask parse(String text) {
        Map<String, String> fields = extractFields(text);

        String title       = fields.getOrDefault("titre", fields.getOrDefault("title", "Tâche reçue via messagerie"));
        String description = fields.getOrDefault("description", text);
        String contacts    = fields.getOrDefault("contacts", fields.getOrDefault("destinataires", null));
        String team        = fields.getOrDefault("équipe", fields.getOrDefault("equipe", fields.getOrDefault("team", null)));
        String typeStr     = fields.getOrDefault("type", fields.getOrDefault("type de tâche", null));
        String prioStr     = fields.getOrDefault("priorité", fields.getOrDefault("priorite", fields.getOrDefault("priority", null)));
        String dueDateStr  = fields.getOrDefault("date limite", fields.getOrDefault("deadline", null));
        String confidStr   = fields.getOrDefault("confidentialité", fields.getOrDefault("confidentialite", "non"));
        String expected    = fields.getOrDefault("résultat attendu", fields.getOrDefault("resultat attendu", null));
        String attachments = fields.getOrDefault("pièces jointes", fields.getOrDefault("pieces jointes", null));

        return new ParsedTask(
            title,
            description,
            contacts,
            team,
            parseTaskType(typeStr),
            parsePriority(prioStr),
            parseDueDate(dueDateStr),
            isTrue(confidStr),
            expected,
            attachments
        );
    }

    private Map<String, String> extractFields(String text) {
        Map<String, String> map = new HashMap<>();
        if (text == null || text.isBlank()) return map;

        // Normalise les séparateurs : emoji + texte → clé: valeur
        String normalized = text
            .replaceAll("👥\\s*", "Contacts: ")
            .replaceAll("🏢\\s*", "Équipe: ")
            .replaceAll("📂\\s*", "Type: ")
            .replaceAll("⚡\\s*", "Priorité: ")
            .replaceAll("⏰\\s*", "Date limite: ")
            .replaceAll("🔒\\s*", "Confidentialité: ")
            .replaceAll("🎯\\s*", "Résultat attendu: ")
            .replaceAll("📎\\s*", "Pièces jointes: ")
            .replaceAll("\\*", "");

        String[] lines = normalized.split("\n");
        for (String line : lines) {
            int colon = line.indexOf(':');
            if (colon > 0) {
                String key   = line.substring(0, colon).trim().toLowerCase();
                String value = line.substring(colon + 1).trim();
                if (!value.isBlank()) {
                    map.put(key, value);
                }
            }
        }
        return map;
    }

    private TaskType parseTaskType(String value) {
        if (value == null) return TaskType.GENERAL;
        try {
            return TaskType.valueOf(value.trim().toUpperCase().replace(" ", "_").replace("-", "_"));
        } catch (IllegalArgumentException e) {
            return TaskType.GENERAL;
        }
    }

    private Priority parsePriority(String value) {
        if (value == null) return Priority.MEDIUM;
        return switch (value.trim().toUpperCase()) {
            case "CRITICAL", "CRITIQUE"    -> Priority.CRITICAL;
            case "HIGH", "HAUTE", "ÉLEVÉE" -> Priority.HIGH;
            case "LOW", "BASSE", "FAIBLE"  -> Priority.LOW;
            default                        -> Priority.MEDIUM;
        };
    }

    private LocalDateTime parseDueDate(String value) {
        if (value == null || value.isBlank()) return null;
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                try {
                    return LocalDateTime.parse(value.trim(), fmt);
                } catch (DateTimeParseException ignored) {
                    // try next
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    private boolean isTrue(String value) {
        if (value == null) return false;
        String v = value.trim().toLowerCase();
        return v.equals("oui") || v.equals("yes") || v.equals("true") || v.equals("1");
    }
}
