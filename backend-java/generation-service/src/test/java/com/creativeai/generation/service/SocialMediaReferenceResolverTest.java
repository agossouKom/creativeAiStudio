package com.creativeai.generation.service;

import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.MediaType;
import com.creativeai.generation.social.MediaReference;
import com.creativeai.generation.social.PlatformCapabilities;
import com.creativeai.generation.social.SocialPlatform;
import com.creativeai.generation.social.SupportLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SocialMediaReferenceResolverTest {

    private static final String PUBLIC_BASE = "https://minio.labibpro.store";

    @Mock private MediaStorageService storageService;

    private SocialMediaReferenceResolver resolver;
    private GenerationOutput output;

    @BeforeEach
    void setUp() {
        resolver = new SocialMediaReferenceResolver(storageService, PUBLIC_BASE + "/");
        output = GenerationOutput.builder()
            .id(1L)
            .jobId("job-1")
            .executionVersion(1)
            .outputIndex(0)
            .bucket("image-generation-results")
            .objectKey("results/job-1/1/image-1.png")
            .contentType("image/png")
            .build();
    }

    private PlatformCapabilities capabilities(MediaReference reference) {
        return new PlatformCapabilities(SocialPlatform.FACEBOOK, "Facebook", SupportLevel.LIVE,
            java.util.Set.of(MediaType.IMAGE), reference, true, true, java.util.List.of(),
            null, java.util.List.of(), "note");
    }

    @Test
    void facebookGetsAPlainPublicMinioUrlWithoutQueryString() {
        String reference = resolver.resolve(capabilities(MediaReference.MINIO_URL), output);

        assertEquals(PUBLIC_BASE + "/image-generation-results/results/job-1/1/image-1.png", reference);
        assertTrue(!reference.contains("?"));
    }

    @Test
    void instagramGetsALongLivedPresignedUrl() {
        when(storageService.presignedPublicUrl(output, 360))
            .thenReturn(PUBLIC_BASE + "/image-generation-results/results/job-1/1/image-1.png?X-Amz-Signature=abc");

        String reference = resolver.resolve(capabilities(MediaReference.PRESIGNED_URL), output);

        assertTrue(reference.startsWith(PUBLIC_BASE + "/image-generation-results/"));
        assertTrue(reference.contains("X-Amz-Signature=abc"));
        verify(storageService).presignedPublicUrl(output, 360);
    }

    @Test
    void platformWithoutUploadAdapterIsRefused() {
        PublishNotAllowedException ex = assertThrows(PublishNotAllowedException.class,
            () -> resolver.resolve(capabilities(MediaReference.BYTES_UPLOAD), output));

        assertEquals("PLATFORM_ADAPTER_MISSING", ex.getCode());
    }

    @Test
    void trailingSlashOfPublicBaseUrlDoesNotDuplicate() {
        assertEquals(PUBLIC_BASE + "/b/k", resolver.resolve(capabilities(MediaReference.MINIO_URL),
            outputWith("b", "k")).substring(0, PUBLIC_BASE.length() + 4));
    }

    private GenerationOutput outputWith(String bucket, String objectKey) {
        return GenerationOutput.builder()
            .bucket(bucket)
            .objectKey(objectKey)
            .contentType("image/png")
            .build();
    }
}
