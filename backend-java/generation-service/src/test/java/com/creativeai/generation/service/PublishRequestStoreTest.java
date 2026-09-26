package com.creativeai.generation.service;

import com.creativeai.generation.model.PublishStatus;
import com.creativeai.generation.model.SocialPublishRequest;
import com.creativeai.generation.repository.SocialPublishRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublishRequestStoreTest {

    @Mock private SocialPublishRequestRepository repository;

    private PublishRequestStore store;

    @BeforeEach
    void setUp() {
        store = new PublishRequestStore(repository);
    }

    private SocialPublishRequest existing(int attempts) {
        SocialPublishRequest request = SocialPublishRequest.builder()
            .requestId("req-1")
            .jobId("job-1")
            .attempts(attempts)
            .status(PublishStatus.PENDING)
            .build();
        when(repository.findById(1L)).thenReturn(Optional.of(request));
        when(repository.save(any(SocialPublishRequest.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        return request;
    }

    @Test
    void dispatchCountsOneAttempt() {
        SocialPublishRequest request = existing(0);

        store.markDispatched(1L, null);

        assertEquals(1, request.getAttempts());
        assertEquals(PublishStatus.DISPATCHED, request.getStatus());
    }

    @Test
    void failureAfterDispatchDoesNotCountASecondAttempt() {
        SocialPublishRequest request = existing(0);
        store.markDispatched(1L, null);

        store.markFailed(1L, "PLATFORM_REJECTED", "refusé");

        assertEquals(1, request.getAttempts());
        assertEquals(PublishStatus.FAILED, request.getStatus());
        assertEquals("PLATFORM_REJECTED", request.getErrorCode());
    }

    @Test
    void successAfterDispatchCountsOneAttemptAndKeepsRemoteId() {
        SocialPublishRequest request = existing(1);

        store.markPublished(1L, "post-42", "https://facebook.com/post-42");

        assertEquals(1, request.getAttempts());
        assertEquals(PublishStatus.PUBLISHED, request.getStatus());
        assertEquals("post-42", request.getRemoteMediaId());
        assertNull(request.getErrorCode());
    }

    @Test
    void dispatchClearsPreviousError() {
        SocialPublishRequest request = existing(1);
        request.setErrorCode("PLATFORM_REJECTED");
        request.setErrorMessage("refusé");

        store.markDispatched(1L, null);

        assertNull(request.getErrorCode());
        assertNull(request.getErrorMessage());
    }

    @Test
    void errorMessageIsTruncated() {
        SocialPublishRequest request = existing(0);

        store.markFailed(1L, "X", "e".repeat(2500));

        assertEquals(1000, request.getErrorMessage().length());
    }
}
