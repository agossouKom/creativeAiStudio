package com.creativeai.generation.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MinioConfigTest {

    @Test
    void keepsSchemeAndAuthorityOfBareHost() {
        assertThat(MinioConfig.endpointOf("https://minio.labibpro.store"))
            .isEqualTo("https://minio.labibpro.store");
    }

    @Test
    void keepsExplicitPort() {
        assertThat(MinioConfig.endpointOf("http://localhost:9400"))
            .isEqualTo("http://localhost:9400");
    }

    @Test
    void dropsReverseProxyPathInsteadOfFailingAtStartup() {
        assertThat(MinioConfig.endpointOf("https://ai.labibpro.com/minio"))
            .isEqualTo("https://ai.labibpro.com");
    }

    @Test
    void treatsBareSlashAsNoPath() {
        assertThat(MinioConfig.endpointOf("https://minio.labibpro.store/"))
            .isEqualTo("https://minio.labibpro.store");
    }

    @Test
    void trimsSurroundingWhitespace() {
        assertThat(MinioConfig.endpointOf("  http://minio:9000  "))
            .isEqualTo("http://minio:9000");
    }

    @Test
    void rejectsUrlWithoutHost() {
        assertThatThrownBy(() -> MinioConfig.endpointOf("minio.labibpro.store"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUrlWithoutScheme() {
        assertThatThrownBy(() -> MinioConfig.endpointOf("//minio.labibpro.store"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
