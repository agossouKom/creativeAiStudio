package com.creativeai.generation.service;

import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.MediaType;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.GenerationOutputRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenerationResultServiceTest {

    private static final String COMPLETED = """
        {"schemaVersion":1,"eventId":"e-1","jobId":"job-1","executionVersion":2,
         "userId":"user@test.dev","type":"COMPLETED","status":"DONE","stage":"FINALIZE","progress":100,
         "result":{"provider":"moneyprinterturbo","outputs":[
           {"bucket":"video-generation-results","objectKey":"results/job-1/2/1/v.mp4",
            "sizeBytes":1024,"sha256":"abc","contentType":"video/mp4"}]}}
        """;

    @Mock private GenerationJobRepository jobRepository;
    @Mock private GenerationOutputRepository outputRepository;

    private GenerationResultService service;

    @BeforeEach
    void setUp() {
        service = new GenerationResultService(jobRepository, outputRepository, new ObjectMapper());
    }

    private GenerationJob job(int version) {
        return GenerationJob.builder()
            .jobId("job-1")
            .userEmail("user@test.dev")
            .mediaType(MediaType.VIDEO)
            .status(JobStatus.PROCESSING)
            .stage("RENDERING")
            .progress(50)
            .executionVersion(version)
            .build();
    }

    private void given(GenerationJob job) {
        when(jobRepository.findByJobId("job-1")).thenReturn(Optional.of(job));
    }

    @Test
    void completedResultMarksJobDoneAndStoresOutput() {
        given(job(2));

        service.apply(COMPLETED);

        ArgumentCaptor<GenerationJob> saved = ArgumentCaptor.forClass(GenerationJob.class);
        verify(jobRepository).save(saved.capture());
        assertEquals(JobStatus.DONE, saved.getValue().getStatus());
        assertEquals(100, saved.getValue().getProgress());
        assertEquals("moneyprinterturbo", saved.getValue().getProvider());
        verify(outputRepository).deleteByJobIdAndExecutionVersion("job-1", 2);

        ArgumentCaptor<GenerationOutput> output = ArgumentCaptor.forClass(GenerationOutput.class);
        verify(outputRepository).save(output.capture());
        assertEquals(0, output.getValue().getOutputIndex());
        assertEquals("results/job-1/2/1/v.mp4", output.getValue().getObjectKey());
    }

    @Test
    void resultWithoutUserIdIsRejected() {
        given(job(2));
        String payload = COMPLETED.replace("\"userId\":\"user@test.dev\",", "");

        assertThrows(IllegalStateException.class, () -> service.apply(payload));

        verify(jobRepository, never()).save(any());
    }

    @Test
    void resultOfAnotherUserIsRejected() {
        given(job(2));
        String payload = COMPLETED.replace("user@test.dev", "pirate@test.dev");

        assertThrows(IllegalStateException.class, () -> service.apply(payload));

        verify(jobRepository, never()).save(any());
    }

    @Test
    void resultForUnknownJobIsRejected() {
        when(jobRepository.findByJobId("job-1")).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> service.apply(COMPLETED));

        verify(outputRepository, never()).save(any());
    }

    @Test
    void resultOfPreviousExecutionIsIgnored() {
        given(job(3));

        service.apply(COMPLETED);

        verify(jobRepository, never()).save(any());
        verify(outputRepository, never()).deleteByJobIdAndExecutionVersion(anyString(), anyInt());
    }

    @Test
    void failedResultKeepsErrorDetails() {
        given(job(2));
        String payload = """
            {"schemaVersion":1,"jobId":"job-1","executionVersion":2,"userId":"user@test.dev",
             "type":"FAILED","status":"FAILED","stage":"RENDERING",
             "error":{"code":"PROVIDER_ERROR","message":"moneyprinter a refuse"}}
            """;

        service.apply(payload);

        ArgumentCaptor<GenerationJob> saved = ArgumentCaptor.forClass(GenerationJob.class);
        verify(jobRepository).save(saved.capture());
        assertEquals(JobStatus.FAILED, saved.getValue().getStatus());
        assertEquals("PROVIDER_ERROR", saved.getValue().getErrorCode());
        assertEquals("moneyprinter a refuse", saved.getValue().getErrorMessage());
        verify(outputRepository, never()).save(any());
    }

    @Test
    void progressEventUpdatesStageOnly() {
        given(job(2));
        String payload = """
            {"schemaVersion":1,"jobId":"job-1","executionVersion":2,"userId":"user@test.dev",
             "type":"PROGRESS","status":"PROCESSING","stage":"RENDERING","progress":80}
            """;

        service.apply(payload);

        ArgumentCaptor<GenerationJob> saved = ArgumentCaptor.forClass(GenerationJob.class);
        verify(jobRepository).save(saved.capture());
        assertEquals(JobStatus.PROCESSING, saved.getValue().getStatus());
        assertEquals(80, saved.getValue().getProgress());
        verify(outputRepository, never()).save(any());
    }

    @Test
    void completedWithoutOutputIsRejected() {
        given(job(2));
        String payload = """
            {"schemaVersion":1,"jobId":"job-1","executionVersion":2,"userId":"user@test.dev",
             "type":"COMPLETED","result":{"outputs":[]}}
            """;

        assertThrows(IllegalArgumentException.class, () -> service.apply(payload));
    }

    @Test
    void outputsAreReplacedNotDuplicated() {
        given(job(2));

        service.apply(COMPLETED);

        verify(outputRepository).deleteByJobIdAndExecutionVersion("job-1", 2);
        verify(outputRepository).flush();
        verify(outputRepository).save(any(GenerationOutput.class));
    }

    @Test
    void resultWithoutJobIdIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.apply("{\"schemaVersion\":1}"));
        verify(jobRepository, never()).findByJobId(anyString());
    }

    @Test
    void unsupportedSchemaVersionIsRejected() {
        given(job(2));
        String payload = COMPLETED.replace("\"schemaVersion\":1", "\"schemaVersion\":2");

        assertThrows(IllegalArgumentException.class, () -> service.apply(payload));
    }

    @Test
    void garbagePayloadIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.apply("pas du json"));
    }

    @Test
    void outputsListKeepsWorkerOrder() {
        given(job(1));
        String payload = """
            {"schemaVersion":1,"jobId":"job-1","executionVersion":1,"userId":"user@test.dev",
             "type":"COMPLETED","result":{"outputs":[
               {"bucket":"b","objectKey":"a.png","contentType":"image/png"},
               {"bucket":"b","objectKey":"b.png","contentType":"image/png"}]}}
            """;

        service.apply(payload);

        ArgumentCaptor<GenerationOutput> captor = ArgumentCaptor.forClass(GenerationOutput.class);
        verify(outputRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        List<GenerationOutput> saved = captor.getAllValues();
        assertEquals(List.of(0, 1), saved.stream().map(GenerationOutput::getOutputIndex).toList());
        assertEquals("a.png", saved.get(0).getObjectKey());
        assertEquals("b.png", saved.get(1).getObjectKey());
    }
}
