package com.creativeai.generation.messaging;

import com.creativeai.generation.dto.ImageOptionsRequest;
import com.creativeai.generation.dto.VideoOptionsRequest;
import com.creativeai.generation.model.GenerationJob;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

/**
 * Construit les commandes Kafka attendues par les workers.
 *
 * Les clés émises sont strictement celles acceptées par
 * ai-workers/video-generation-worker/app/events.py et
 * ai-workers/image-generation-worker/app/events.py : un worker rejette tout
 * événement contenant une option inconnue, donc rien n'est envoyé en trop.
 */
@Component
public class GenerationCommandFactory {

    private static final Set<String> VIDEO_ASPECT_RATIOS = Set.of("16:9", "9:16", "1:1");
    private static final Set<String> VIDEO_SOURCES = Set.of("pexels", "pixabay", "coverr");
    private static final Set<String> RESPONSE_FORMATS = Set.of("b64_json", "url");

    private final ObjectMapper objectMapper;

    public GenerationCommandFactory(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String videoCommand(GenerationJob job, VideoOptionsRequest requested) {
        return videoCommand(job, requested, java.util.List.of());
    }

    public String videoCommand(
            GenerationJob job, VideoOptionsRequest requested, java.util.List<JsonNode> storyboards) {
        VideoOptionsRequest options = requested == null ? VideoOptionsRequest.defaults() : requested.normalized();

        if (!VIDEO_ASPECT_RATIOS.contains(options.aspectRatio())) {
            throw new IllegalArgumentException("aspectRatio doit valoir 16:9, 9:16 ou 1:1");
        }
        if (!VIDEO_SOURCES.contains(options.source())) {
            throw new IllegalArgumentException("source doit valoir pexels, pixabay ou coverr");
        }
        requireBetween(options.videoCount(), 1, 10, "videoCount");
        requireBetween(options.clipDurationSeconds(), 1, 60, "clipDurationSeconds");

        ObjectNode root = baseNode(job);
        root.put("prompt", job.getPrompt().trim());

        ObjectNode opts = root.putObject("options");
        opts.put("aspectRatio", options.aspectRatio());
        opts.put("subtitles", options.subtitles());
        opts.put("videoCount", options.videoCount());
        opts.put("clipDurationSeconds", options.clipDurationSeconds());
        opts.put("source", options.source());
        if (!storyboards.isEmpty()) {
            if (storyboards.size() != options.videoCount()) {
                throw new IllegalArgumentException(
                    "Le nombre de storyboards doit correspondre à videoCount");
            }
            root.set("storyboards", objectMapper.valueToTree(storyboards));
        }
        if (options.language() != null) {
            opts.put("language", options.language());
        }
        if (options.voice() != null) {
            opts.put("voice", options.voice());
        }
        return write(root);
    }

    public String imageCommand(GenerationJob job, ImageOptionsRequest requested) {
        ImageOptionsRequest options = requested == null ? ImageOptionsRequest.defaults() : requested.normalized();

        requireBetween(options.count(), 1, 10, "count");
        if (!RESPONSE_FORMATS.contains(options.responseFormat())) {
            throw new IllegalArgumentException("responseFormat doit valoir b64_json ou url");
        }
        if (!options.dimensionsWithinProviderLimits()) {
            throw new IllegalArgumentException("size doit avoir des dimensions entre 64 et 4096");
        }
        if (options.seed() != null && (options.seed() < 0 || options.seed() > 2147483647L)) {
            throw new IllegalArgumentException("seed doit être compris entre 0 et 2147483647");
        }

        ObjectNode root = baseNode(job);
        root.put("prompt", job.getPrompt().trim());
        if (job.getNegativePrompt() != null && !job.getNegativePrompt().isBlank()) {
            root.put("negativePrompt", job.getNegativePrompt().trim());
        }

        ObjectNode opts = root.putObject("options");
        opts.put("size", options.size());
        opts.put("count", options.count());
        opts.put("responseFormat", options.responseFormat());
        if (options.model() != null) opts.put("model", options.model());
        if (options.style() != null) opts.put("style", options.style());
        if (options.quality() != null) opts.put("quality", options.quality());
        if (options.seed() != null) opts.put("seed", options.seed());
        return write(root);
    }

    private ObjectNode baseNode(GenerationJob job) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("schemaVersion", 1);
        root.put("eventId", UUID.randomUUID().toString());
        root.put("jobId", job.getJobId());
        root.put("executionVersion", job.getExecutionVersion());
        root.put("userId", job.getUserEmail());
        return root;
    }

    private void requireBetween(Integer value, int min, int max, String field) {
        if (value == null || value < min || value > max) {
            throw new IllegalArgumentException(field + " doit être compris entre " + min + " et " + max);
        }
    }

    private String write(ObjectNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Commande de génération non sérialisable", e);
        }
    }
}
