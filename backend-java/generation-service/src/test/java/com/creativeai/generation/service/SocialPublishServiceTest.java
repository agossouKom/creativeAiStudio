package com.creativeai.generation.service;

import com.creativeai.generation.dto.PublishRequest;
import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.MediaType;
import com.creativeai.generation.model.PublishStatus;
import com.creativeai.generation.model.SocialPublishRequest;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.GenerationOutputRepository;
import com.creativeai.generation.repository.SocialPublishRequestRepository;
import com.creativeai.generation.social.MediaReference;
import com.creativeai.generation.social.PlatformCapabilities;
import com.creativeai.generation.social.SocialPlatform;
import com.creativeai.generation.social.SocialPlatformRegistry;
import com.creativeai.generation.social.SupportLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SocialPublishServiceTest {

    /** Jeton de l'appelant relayé vers agent-team-service. */
    private static final String TOKEN = "caller.jwt.token";

    @Mock private GenerationJobRepository jobRepository;
    @Mock private GenerationOutputRepository outputRepository;
    @Mock private SocialPublishRequestRepository publishRepository;
    @Mock private SocialMediaReferenceResolver referenceResolver;
    @Mock private AgentTeamSocialClient agentTeamClient;
    @Mock private PublishRequestStore store;

    private SocialPublishService service;

    @BeforeEach
    void setUp() {
        service = new SocialPublishService(jobRepository, outputRepository, publishRepository,
            new SocialPlatformRegistry(), referenceResolver, agentTeamClient, store, true);
    }

    private GenerationJob job(JobStatus status, MediaType mediaType) {
        return GenerationJob.builder()
            .jobId("job-1")
            .userEmail("user@test.dev")
            .mediaType(mediaType)
            .status(status)
            .stage("FINALIZE")
            .progress(100)
            .prompt("une baleine dans le désert")
            .executionVersion(2)
            .build();
    }

    private GenerationOutput output() {
        return GenerationOutput.builder()
            .jobId("job-1")
            .executionVersion(2)
            .outputIndex(0)
            .bucket("video-generation-results")
            .objectKey("results/job-1/2/video-0.mp4")
            .sizeBytes(4096L)
            .contentType("video/mp4")
            .build();
    }

    private void givenJobAndOutput(GenerationJob job) {
        when(jobRepository.findByJobIdAndUserEmail("job-1", "user@test.dev")).thenReturn(Optional.of(job));
        when(outputRepository.findByJobIdAndExecutionVersionAndOutputIndex("job-1", 2, 0))
            .thenReturn(Optional.of(output()));
    }

    @Test
    void refusesToPublishWhenJobIsNotDone() {
        givenJobAndOutput(job(JobStatus.PROCESSING, MediaType.VIDEO));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> service.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.INSTAGRAM, "agent-1", null), TOKEN));

        assertEquals("JOB_NOT_READY", error.getCode());
        verify(agentTeamClient, never()).publish(anyString(), any(), anyString(), any(), anyString());
    }

    @Test
    void refusesPlatformWithoutAdapter() {
        givenJobAndOutput(job(JobStatus.DONE, MediaType.VIDEO));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> service.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.TIKTOK, "agent-1", null), TOKEN));

        assertEquals("PLATFORM_NOT_AVAILABLE", error.getCode());
        assertTrue(error.getMessage().contains("adaptateur"));
        verify(agentTeamClient, never()).publish(anyString(), any(), anyString(), any(), anyString());
    }

    @Test
    void refusesMediaTypeThePlatformDoesNotAccept() {
        SocialPlatformRegistry videoOnlyRegistry = mock(SocialPlatformRegistry.class);
        PlatformCapabilities videoOnly = new PlatformCapabilities(
            SocialPlatform.FACEBOOK, "Facebook", SupportLevel.LIVE, java.util.Set.of(MediaType.VIDEO),
            MediaReference.MINIO_URL, true, true, List.of("pages_manage_posts"), 600, List.of("9:16"),
            "adaptateur de test");
        when(videoOnlyRegistry.get(SocialPlatform.FACEBOOK)).thenReturn(videoOnly);
        SocialPublishService serviceUnderTest = new SocialPublishService(jobRepository, outputRepository,
            publishRepository, videoOnlyRegistry, referenceResolver, agentTeamClient, store, true);

        when(jobRepository.findByJobIdAndUserEmail("job-1", "user@test.dev"))
            .thenReturn(Optional.of(job(JobStatus.DONE, MediaType.IMAGE)));
        when(outputRepository.findByJobIdAndExecutionVersionAndOutputIndex("job-1", 2, 0))
            .thenReturn(Optional.of(output()));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> serviceUnderTest.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.FACEBOOK, "agent-1", null), TOKEN));

        assertEquals("PLATFORM_MEDIA_UNSUPPORTED", error.getCode());
        verify(agentTeamClient, never()).publish(anyString(), any(), anyString(), any(), anyString());
    }

    @Test
    void refusesPublicationWhenDisabled() {
        SocialPublishService disabled = new SocialPublishService(jobRepository, outputRepository,
            publishRepository, new SocialPlatformRegistry(), referenceResolver, agentTeamClient, store, false);
        givenJobAndOutput(job(JobStatus.DONE, MediaType.VIDEO));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> disabled.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.INSTAGRAM, "agent-1", null), TOKEN));

        assertEquals("SOCIAL_PUBLISH_DISABLED", error.getCode());
    }

    @Test
    void refusesPublicationWithoutAgentId() {
        givenJobAndOutput(job(JobStatus.DONE, MediaType.VIDEO));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> service.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.INSTAGRAM, "  ", null), TOKEN));

        assertEquals("AGENT_ID_REQUIRED", error.getCode());
    }

    @Test
    void publishesToInstagramAndRecordsRemoteMediaId() {
        givenJobAndOutput(job(JobStatus.DONE, MediaType.VIDEO));
        when(referenceResolver.resolve(any(), any()))
            .thenReturn("https://minio.labibpro.store/video-generation-results/results/job-1/2/video-0.mp4?X-Amz-Signature=abc");
        when(store.create(any())).thenAnswer(invocation -> {
            SocialPublishRequest request = invocation.getArgument(0);
            request.setId(42L);
            return request;
        });
        when(store.markPublished(any(), any(), any())).thenAnswer(invocation -> {
            SocialPublishRequest request = new SocialPublishRequest();
            request.setId(42L);
            request.setRequestId("req-1");
            request.setStatus(PublishStatus.PUBLISHED);
            request.setPlatform(SocialPlatform.INSTAGRAM);
            request.setCaption("une baleine dans le désert");
            return request;
        });
        when(agentTeamClient.publish(anyString(), any(), anyString(), any(), anyString()))
            .thenReturn(new AgentTeamSocialClient.AgentPostResult(true, "1789media", null));

        var response = service.publish("job-1", 0, "user@test.dev",
            new PublishRequest(SocialPlatform.INSTAGRAM, "agent-1", null), TOKEN);

        assertEquals(PublishStatus.PUBLISHED, response.status());
        verify(agentTeamClient).publish(anyString(), any(), anyString(), any(), eq(TOKEN));
        verify(store).markDispatched(any(), any());
    }

    @Test
    void recordsFailureWhenPlatformRejectsThePost() {
        givenJobAndOutput(job(JobStatus.DONE, MediaType.IMAGE));
        when(referenceResolver.resolve(any(), any())).thenReturn("https://minio.labibpro.store/x.png?sig=1");
        when(store.create(any())).thenAnswer(invocation -> {
            SocialPublishRequest request = invocation.getArgument(0);
            request.setId(42L);
            return request;
        });
        when(agentTeamClient.publish(anyString(), any(), anyString(), any(), anyString()))
            .thenReturn(new AgentTeamSocialClient.AgentPostResult(false, null,
                "Instagram API 400: media is not reachable"));

        PlatformApiException error = assertThrows(PlatformApiException.class,
            () -> service.publish("job-1", 0, "user@test.dev",
                new PublishRequest(SocialPlatform.INSTAGRAM, "agent-1", "ma légende"), TOKEN));

        assertEquals("PLATFORM_REJECTED", error.getCode());
        verify(store).markFailed(any(), anyString(), anyString());
        verify(store, never()).markPublished(any(), any(), any());
    }

    @Test
    void retryRefusesWhenMaxAttemptsReached() {
        SocialPublishRequest request = SocialPublishRequest.builder()
            .requestId("req-1")
            .jobId("job-1")
            .executionVersion(2)
            .outputIndex(0)
            .userEmail("user@test.dev")
            .platform(SocialPlatform.INSTAGRAM)
            .agentId("agent-1")
            .status(PublishStatus.FAILED)
            .attempts(3)
            .build();
        when(publishRepository.findByRequestIdAndUserEmail("req-1", "user@test.dev"))
            .thenReturn(Optional.of(request));

        PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
            () -> service.retry("req-1", "user@test.dev", TOKEN));

        assertEquals("MAX_ATTEMPTS_REACHED", error.getCode());
        verify(outputRepository, never())
            .findByJobIdAndExecutionVersionAndOutputIndex(anyString(), anyInt(), anyInt());
    }

    private SocialPublishRequest retryableRequest(PublishStatus status, int executionVersion) {
        return SocialPublishRequest.builder()
            .id(42L)
            .requestId("req-1")
            .jobId("job-1")
            .executionVersion(executionVersion)
            .outputIndex(0)
            .userEmail("user@test.dev")
            .platform(SocialPlatform.INSTAGRAM)
            .agentId("agent-1")
            .status(status)
            .caption("une baleine dans le désert")
            .attempts(1)
            .build();
    }

    @Test
    void retryLooksUpTheOutputOfTheRequestVersionNotTheCurrentJobVersion() {
        when(publishRepository.findByRequestIdAndUserEmail("req-1", "user@test.dev"))
            .thenReturn(Optional.of(retryableRequest(PublishStatus.FAILED, 1)));
        when(jobRepository.findByJobIdAndUserEmail("job-1", "user@test.dev"))
            .thenReturn(Optional.of(job(JobStatus.DONE, MediaType.VIDEO)));
        when(outputRepository.findByJobIdAndExecutionVersionAndOutputIndex("job-1", 1, 0))
            .thenReturn(Optional.of(GenerationOutput.builder()
                .jobId("job-1").executionVersion(1).outputIndex(0)
                .bucket("video-generation-results").objectKey("results/job-1/1/video-0.mp4")
                .build()));
        when(referenceResolver.resolve(any(), any())).thenReturn("https://minio.labibpro.store/v1.mp4");
        when(store.markPublished(any(), any(), any())).thenAnswer(invocation -> {
            SocialPublishRequest request = new SocialPublishRequest();
            request.setRequestId("req-1");
            request.setStatus(PublishStatus.PUBLISHED);
            request.setPlatform(SocialPlatform.INSTAGRAM);
            return request;
        });
        when(agentTeamClient.publish(anyString(), any(), anyString(), any(), anyString()))
            .thenReturn(new AgentTeamSocialClient.AgentPostResult(true, "1789media", null));

        var response = service.retry("req-1", "user@test.dev", TOKEN);

        assertEquals(PublishStatus.PUBLISHED, response.status());
        verify(outputRepository).findByJobIdAndExecutionVersionAndOutputIndex("job-1", 1, 0);
        verify(outputRepository, never())
            .findByJobIdAndExecutionVersionAndOutputIndex("job-1", 2, 0);
    }

    @Test
    void retryFailsWhenTheOutputOfTheRequestVersionIsGone() {
        when(publishRepository.findByRequestIdAndUserEmail("req-1", "user@test.dev"))
            .thenReturn(Optional.of(retryableRequest(PublishStatus.FAILED, 1)));
        when(jobRepository.findByJobIdAndUserEmail("job-1", "user@test.dev"))
            .thenReturn(Optional.of(job(JobStatus.DONE, MediaType.VIDEO)));
        when(outputRepository.findByJobIdAndExecutionVersionAndOutputIndex("job-1", 1, 0))
            .thenReturn(Optional.empty());

        assertThrows(com.creativeai.generation.exception.ResourceNotFoundException.class,
            () -> service.retry("req-1", "user@test.dev", TOKEN));

        verify(agentTeamClient, never()).publish(anyString(), any(), anyString(), any(), anyString());
        verify(store, never()).markDispatched(any(), any());
    }

    @Test
    void retryRefusesADispatchOfUnknownOutcomeToAvoidDuplicatePosts() {
        for (PublishStatus status : List.of(PublishStatus.PENDING, PublishStatus.DISPATCHED)) {
            when(publishRepository.findByRequestIdAndUserEmail("req-1", "user@test.dev"))
                .thenReturn(Optional.of(retryableRequest(status, 2)));

            PublishNotAllowedException error = assertThrows(PublishNotAllowedException.class,
                () -> service.retry("req-1", "user@test.dev", TOKEN));

            assertEquals("DISPATCH_IN_PROGRESS", error.getCode());
        }
        verify(agentTeamClient, never()).publish(anyString(), any(), anyString(), any(), anyString());
        verify(store, never()).markDispatched(any(), any());
    }

    @Test
    void listForJobChecksOwnershipFirst() {        when(jobRepository.findByJobIdAndUserEmail("job-1", "user@test.dev")).thenReturn(Optional.empty());

        assertThrows(com.creativeai.generation.exception.ResourceNotFoundException.class,
            () -> service.listForJob("job-1", "user@test.dev"));
        verify(publishRepository, never()).findByJobIdOrderByCreatedAtDesc(anyString());
    }

    @Test
    void mediaReferencesUseOneEntryPerOutput() {
        givenJobAndOutput(job(JobStatus.DONE, MediaType.VIDEO));
        when(referenceResolver.resolve(any(), any())).thenReturn("https://minio.labibpro.store/a/b.mp4");
        when(store.create(any())).thenAnswer(invocation -> {
            SocialPublishRequest request = invocation.getArgument(0);
            request.setId(7L);
            return request;
        });
        when(store.markPublished(any(), any(), any())).thenAnswer(invocation -> {
            SocialPublishRequest request = new SocialPublishRequest();
            request.setId(7L);
            request.setRequestId("req-7");
            request.setStatus(PublishStatus.PUBLISHED);
            request.setPlatform(SocialPlatform.FACEBOOK);
            return request;
        });
        when(agentTeamClient.publish(anyString(), any(), anyString(), any(), anyString()))
            .thenReturn(new AgentTeamSocialClient.AgentPostResult(true, "1234567890", null));

        var response = service.publish("job-1", 0, "user@test.dev",
            new PublishRequest(SocialPlatform.FACEBOOK, "agent-1", "hello"), TOKEN);

        assertEquals(PublishStatus.PUBLISHED, response.status());
        org.mockito.ArgumentCaptor<List<String>> captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(agentTeamClient).publish(anyString(), any(), anyString(), captor.capture(), eq(TOKEN));
        assertEquals(1, captor.getValue().size());
    }
}
