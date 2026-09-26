package com.creativeai.generation.messaging;

import com.creativeai.generation.model.JobStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GenerationResultMapperTest {

    private final GenerationResultMapper mapper = new GenerationResultMapper(new ObjectMapper());

    @Test
    void progressEventBecomesProcessing() {
        var update = mapper.map("""
            {"schemaVersion":1,"jobId":"job-1","executionVersion":2,"userId":"u@d.dev",
             "type":"PROGRESS","status":"PROCESSING","stage":"STORAGE","progress":70}
            """);

        assertEquals(JobStatus.PROCESSING, update.status());
        assertEquals("STORAGE", update.stage());
        assertEquals(70, update.progress());
    }

    @Test
    void progressIsClampedToHundred() {
        var update = mapper.map("""
            {"schemaVersion":1,"type":"PROGRESS","stage":"RENDERING","progress":150}
            """);

        assertEquals(100, update.progress());
    }

    @Test
    void completedEventCarriesStoredOutputs() {
        var update = mapper.map("""
            {"schemaVersion":1,"jobId":"job-1","type":"COMPLETED","status":"DONE",
             "stage":"FINALIZE","progress":100,"providerTaskId":"task-7",
             "result":{"provider":"moneyprinterturbo","providerTaskId":"task-7",
               "outputCount":2,"storageRequired":false,
               "outputs":[
                 {"bucket":"video-generation-results","objectKey":"results/job-1/2/video-0.mp4",
                  "sizeBytes":1024,"sha256":"abc","contentType":"video/mp4"},
                 {"bucket":"video-generation-results","objectKey":"results/job-1/2/video-1.mp4",
                  "sizeBytes":2048,"sha256":"def","contentType":"video/mp4"}]}}
            """);

        assertEquals(JobStatus.DONE, update.status());
        assertEquals("FINALIZE", update.stage());
        assertEquals("moneyprinterturbo", update.provider());
        assertEquals("task-7", update.providerTaskId());
        List<GenerationResultMapper.StoredOutput> outputs = update.outputs();
        assertNotNull(outputs);
        assertEquals(2, outputs.size());
        assertEquals(0, outputs.get(0).index());
        assertEquals("video-generation-results", outputs.get(0).bucket());
        assertEquals(1024L, outputs.get(0).sizeBytes());
        assertEquals("results/job-1/2/video-1.mp4", outputs.get(1).objectKey());
    }

    @Test
    void completedWithoutOutputIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> mapper.map("""
            {"schemaVersion":1,"type":"COMPLETED","result":{"outputs":[]}}
            """));
    }

    @Test
    void completedWithIncompleteOutputIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> mapper.map("""
            {"schemaVersion":1,"type":"COMPLETED","result":{"outputs":[{"bucket":"b","objectKey":"k"}]}}
            """));
    }

    @Test
    void providerTaskIdIsReadFromResultWhenAbsentAtRoot() {
        var update = mapper.map("""
            {"schemaVersion":1,"type":"COMPLETED","stage":"FINALIZE","progress":100,
             "result":{"provider":"openai","providerTaskId":"task-nested","outputs":[
              {"bucket":"b","objectKey":"k","contentType":"image/png"}]}}
            """);

        assertEquals("task-nested", update.providerTaskId());
    }

    @Test
    void failedEventKeepsErrorCode() {
        var update = mapper.map("""
            {"schemaVersion":1,"type":"FAILED","stage":"STORAGE",
             "error":{"code":"STORAGE_ERROR","message":"minio indisponible"}}
            """);

        assertEquals(JobStatus.FAILED, update.status());
        assertEquals("STORAGE_ERROR", update.errorCode());
        assertEquals("minio indisponible", update.errorMessage());
    }

    @Test
    void failedEventWithoutErrorGetsDefaultCode() {
        var update = mapper.map("""
            {"schemaVersion":1,"type":"FAILED"}
            """);

        assertEquals(JobStatus.FAILED, update.status());
        assertEquals("WORKER_ERROR", update.errorCode());
    }

    @Test
    void unsupportedSchemaVersionIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> mapper.map("""
            {"schemaVersion":2,"type":"PROGRESS"}
            """));
    }

    @Test
    void unknownEventTypeIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> mapper.map("""
            {"schemaVersion":1,"type":"CANCELLED"}
            """));
    }

    @Test
    void malformedPayloadIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> mapper.map("pas-du-json"));
    }

    @Test
    void hugeErrorMessageIsTruncatedToColumnWidth() {
        String message = "x".repeat(2500);
        var update = mapper.map("""
            {"schemaVersion":1,"type":"FAILED","error":{"code":"E","message":"%s"}}
            """.formatted(message));

        assertTrue(update.errorMessage().length() <= 1000);
    }
}
