package com.creativeai.generation.messaging;

import com.creativeai.generation.model.JobStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * Traduit un événement de résultat émis par un worker en mise à jour de job.
 *
 * Volontairement sans dépendance à JPA ni à Kafka : la logique est testable seule
 * et le service ne fait qu'appliquer ce que cette classe a décidé.
 */
public class GenerationResultMapper {

    private final ObjectMapper objectMapper;

    public GenerationResultMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public record StoredOutput(int index, String bucket, String objectKey,
                               Long sizeBytes, String sha256, String contentType) {}

    public record ResultUpdate(JobStatus status, String stage, Integer progress,
                               String provider, String providerTaskId,
                               String errorCode, String errorMessage,
                               List<StoredOutput> outputs) {}

    /**
     * @throws IllegalArgumentException si l'événement est illisible : l'erreur Kafka
     *         est alors traitée par le handler (retry puis DLQ).
     */
    public ResultUpdate map(String payload) {
        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            throw new IllegalArgumentException("Résultat de génération illisible", e);
        }
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("Résultat de génération illisible");
        }
        int schemaVersion = root.path("schemaVersion").asInt(-1);
        if (schemaVersion != 1) {
            throw new IllegalArgumentException("schemaVersion non supporté: " + schemaVersion);
        }
        String type = text(root, "type");
        String stage = text(root, "stage");
        int progress = Math.max(0, Math.min(100, root.path("progress").asInt(0)));
        String providerTaskId = text(root, "providerTaskId");

        return switch (type) {
            case "PROGRESS" -> new ResultUpdate(JobStatus.PROCESSING,
                stage != null ? stage : "PROCESSING", progress, null, providerTaskId, null, null, null);
            case "FAILED" -> new ResultUpdate(JobStatus.FAILED,
                stage != null ? stage : "FAILED", 0, null, providerTaskId,
                errorCode(root), errorMessage(root), null);
            case "COMPLETED" -> completed(root, stage, providerTaskId);
            default -> throw new IllegalArgumentException("type de résultat non supporté: " + type);
        };
    }

    private ResultUpdate completed(JsonNode root, String stage, String providerTaskId) {
        JsonNode result = root.path("result");
        JsonNode outputsNode = result.path("outputs");
        if (!outputsNode.isArray() || outputsNode.isEmpty()) {
            throw new IllegalArgumentException("Résultat COMPLETED sans sortie stockée");
        }
        List<StoredOutput> outputs = new ArrayList<>();
        int index = 0;
        for (JsonNode output : outputsNode) {
            String bucket = text(output, "bucket");
            String objectKey = text(output, "objectKey");
            String contentType = text(output, "contentType");
            if (bucket == null || objectKey == null || contentType == null) {
                throw new IllegalArgumentException("Sortie stockée incomplète: bucket/objectKey/contentType requis");
            }
            outputs.add(new StoredOutput(
                index++,
                bucket,
                objectKey,
                output.hasNonNull("sizeBytes") ? output.get("sizeBytes").asLong() : null,
                text(output, "sha256"),
                contentType));
        }
        return new ResultUpdate(JobStatus.DONE,
            stage != null ? stage : "FINALIZE", 100,
            text(result, "provider"),
            providerTaskId != null ? providerTaskId : text(result, "providerTaskId"),
            null, null, outputs);
    }

    private String errorCode(JsonNode root) {
        String code = text(root.path("error"), "code");
        return code != null ? truncate(code, 80) : "WORKER_ERROR";
    }

    private String errorMessage(JsonNode root) {
        String message = text(root.path("error"), "message");
        return truncate(message != null ? message : "Échec du worker", 1000);
    }

    private String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || !value.isTextual()) {
            return null;
        }
        String normalized = value.asText().trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
