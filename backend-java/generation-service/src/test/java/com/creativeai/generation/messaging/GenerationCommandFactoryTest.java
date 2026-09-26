package com.creativeai.generation.messaging;

import com.creativeai.generation.dto.ImageOptionsRequest;
import com.creativeai.generation.dto.VideoOptionsRequest;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.MediaType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.List;

class GenerationCommandFactoryTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GenerationCommandFactory factory = new GenerationCommandFactory(objectMapper);

    private GenerationJob job(MediaType mediaType, String negativePrompt) {
        return GenerationJob.builder()
            .jobId("job-1")
            .userEmail("user@test.dev")
            .mediaType(mediaType)
            .status(JobStatus.QUEUED)
            .prompt("  une baleine dans le désert  ")
            .negativePrompt(negativePrompt)
            .executionVersion(3)
            .build();
    }

    private JsonNode parse(String payload) throws Exception {
        return objectMapper.readTree(payload);
    }

    @Test
    void videoCommandUsesOnlyOptionsAcceptedByTheWorker() throws Exception {
        String payload = factory.videoCommand(job(MediaType.VIDEO, null),
            new VideoOptionsRequest("9:16", "fr", "alloy", true, 2, 8, "pixabay"));

        JsonNode root = parse(payload);
        assertEquals(1, root.get("schemaVersion").asInt());
        assertEquals("job-1", root.get("jobId").asText());
        assertEquals(3, root.get("executionVersion").asInt());
        assertEquals("user@test.dev", root.get("userId").asText());
        assertEquals("une baleine dans le désert", root.get("prompt").asText());

        JsonNode options = root.get("options");
        assertEquals("9:16", options.get("aspectRatio").asText());
        assertEquals("fr", options.get("language").asText());
        assertEquals("alloy", options.get("voice").asText());
        assertTrue(options.get("subtitles").asBoolean());
        assertEquals(2, options.get("videoCount").asInt());
        assertEquals(8, options.get("clipDurationSeconds").asInt());
        assertEquals("pixabay", options.get("source").asText());
        assertEquals(7, options.size(), "aucune option surnuméraire ne doit partir vers le worker");
    }

    @Test
    void videoCommandOmitsAbsentOptionalOptions() throws Exception {
        String payload = factory.videoCommand(job(MediaType.VIDEO, null), VideoOptionsRequest.defaults());

        JsonNode options = parse(payload).get("options");
        assertFalse(options.has("language"));
        assertFalse(options.has("voice"));
        assertEquals("9:16", options.get("aspectRatio").asText());
        assertEquals(1, options.get("videoCount").asInt());
    }

    @Test
    void videoCommandIncludesStoryboardButNeverProviderCredentials() throws Exception {
        JsonNode storyboard = objectMapper.readTree("""
            {"title":"Launch","duration":5,"scenes":[]}
            """);
        JsonNode root = parse(factory.videoCommand(
            job(MediaType.VIDEO, null),
            new VideoOptionsRequest("9:16", "fr", null, true, 1, 5, "pexels"),
            List.of(storyboard)));

        assertEquals("Launch", root.path("storyboards").get(0).path("title").asText());
        assertFalse(root.has("apiKey"));
        assertFalse(root.has("provider"));
    }

    @Test
    void videoCommandRequiresOneStoryboardPerVideo() {
        JsonNode storyboard = objectMapper.createObjectNode();
        assertThrows(IllegalArgumentException.class, () -> factory.videoCommand(
            job(MediaType.VIDEO, null),
            new VideoOptionsRequest("9:16", null, null, true, 2, 5, "pexels"),
            List.of(storyboard)));
    }

    @Test
    void videoCommandRejectsUnsupportedAspectRatio() {
        assertThrows(IllegalArgumentException.class, () -> factory.videoCommand(
            job(MediaType.VIDEO, null), new VideoOptionsRequest("4:3", null, null, true, 1, 5, "pexels")));
    }

    @Test
    void videoCommandRejectsUnsupportedSource() {
        assertThrows(IllegalArgumentException.class, () -> factory.videoCommand(
            job(MediaType.VIDEO, null), new VideoOptionsRequest("16:9", null, null, true, 1, 5, "giphy")));
    }

    @Test
    void videoCommandRejectsOutOfRangeCountAndDuration() {
        assertThrows(IllegalArgumentException.class, () -> factory.videoCommand(
            job(MediaType.VIDEO, null), new VideoOptionsRequest("16:9", null, null, true, 11, 5, "pexels")));
        assertThrows(IllegalArgumentException.class, () -> factory.videoCommand(
            job(MediaType.VIDEO, null), new VideoOptionsRequest("16:9", null, null, true, 1, 61, "pexels")));
    }

    @Test
    void imageCommandCarriesNegativePromptAndOptions() throws Exception {
        String payload = factory.imageCommand(job(MediaType.IMAGE, "flou, texte"),
            new ImageOptionsRequest("1024x1024", 2, "gpt-image-1", "vivid", "hd", 42L, "b64_json"));

        JsonNode root = parse(payload);
        assertEquals("flou, texte", root.get("negativePrompt").asText());
        JsonNode options = root.get("options");
        assertEquals("1024x1024", options.get("size").asText());
        assertEquals(2, options.get("count").asInt());
        assertEquals("gpt-image-1", options.get("model").asText());
        assertEquals("vivid", options.get("style").asText());
        assertEquals("hd", options.get("quality").asText());
        assertEquals(42, options.get("seed").asInt());
        assertEquals("b64_json", options.get("responseFormat").asText());
        assertEquals(7, options.size());
    }

    @Test
    void imageCommandOmitsEmptyNegativePrompt() throws Exception {
        String payload = factory.imageCommand(job(MediaType.IMAGE, null), ImageOptionsRequest.defaults());

        JsonNode root = parse(payload);
        assertFalse(root.has("negativePrompt"));
        assertEquals("b64_json", root.get("options").get("responseFormat").asText());
        assertEquals(3, root.get("options").size());
    }

    @Test
    void imageCommandRejectsDimensionsOutsideWorkerLimits() {
        assertThrows(IllegalArgumentException.class, () -> factory.imageCommand(
            job(MediaType.IMAGE, null), new ImageOptionsRequest("8192x8192", 1, null, null, null, null, "b64_json")));
        assertThrows(IllegalArgumentException.class, () -> factory.imageCommand(
            job(MediaType.IMAGE, null), new ImageOptionsRequest("16x16", 1, null, null, null, null, "b64_json")));
    }

    @Test
    void imageCommandRejectsUnknownResponseFormat() {
        assertThrows(IllegalArgumentException.class, () -> factory.imageCommand(
            job(MediaType.IMAGE, null), new ImageOptionsRequest("512x512", 1, null, null, null, null, "binarize")));
    }
}
