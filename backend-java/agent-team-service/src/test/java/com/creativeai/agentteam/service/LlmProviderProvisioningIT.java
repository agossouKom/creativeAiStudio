package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie que le provider par défaut est réellement <b>persisté</b> quand il est
 * provisionné depuis une méthode {@code @Transactional(readOnly = true)}.
 *
 * <p>Ce test existe parce que le défaut n'apparaissait pas du tout autrement : la
 * réponse HTTP était correcte (bon modèle, bonne clé, bon propriétaire) et le
 * journal annonçait la réussite, mais la ligne n'était jamais écrite. En
 * lecture seule, Spring bascule Hibernate en {@code FlushMode.MANUAL} : le
 * {@code save()} reste en mémoire et l'INSERT n'est jamais exécuté. La
 * conséquence pour l'utilisateur était silencieuse — son provider disparaissait
 * et revenait à chaque appel — etaucun test unitaire à mocks ne l'aurait vue.
 *
 * <p>Le test appelle donc le service depuis une méthode réellement annotée
 * {@code readOnly = true}, puis relit la base par une autre transaction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Testcontainers
class LlmProviderProvisioningIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("creativeai_agents_test")
        .withUsername("creativeai")
        .withPassword("creativeai123");

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @MockBean RedisConnectionFactory        redisConnectionFactory;
    @MockBean ReactiveRedisConnectionFactory reactiveRedisConnectionFactory;
    @MockBean KafkaTemplate<Object,Object>  kafkaTemplate;
    @MockBean JavaMailSender                javaMailSender;
    @MockBean MinioClient                   minioClient;

    /** Reproduit la condition réelle : un appelant en lecture seule. */
    @TestConfiguration
    static class ReadOnlyCaller {
        private final LlmProviderProvisioningService provisioning;

        ReadOnlyCaller(LlmProviderProvisioningService provisioning) {
            this.provisioning = provisioning;
        }

        @Bean
        Caller caller() {
            return new Caller(provisioning);
        }
    }

    static class Caller {
        private final LlmProviderProvisioningService provisioning;

        Caller(LlmProviderProvisioningService provisioning) {
            this.provisioning = provisioning;
        }

        /** Même annotation que {@code AgentService.resolveLlmProviderFor}. */
        @Transactional(readOnly = true)
        public Optional<LlmProvider> provisionAsReadOnlyCaller(String userId) {
            return provisioning.ensureDefaultProviderFor(userId);
        }
    }

    @Autowired LlmProviderRepository    repo;
    @Autowired Caller                   caller;
    @Autowired LlmProviderProvisioningService provisioning;

    private static final String NEW_ACCOUNT   = "inscription-test@creativeai.local";
    private static final String ADMIN_ACCOUNT = "admin-platform-test@creativeai.local";

    @AfterEach
    void cleanup() {
        repo.findAll().stream()
            .filter(p -> NEW_ACCOUNT.equals(p.getUserId()) || ADMIN_ACCOUNT.equals(p.getUserId()))
            .forEach(p -> repo.deleteById(p.getId()));
        provisioning.clearPlatformDefault();
    }

    private LlmProvider seedPlatformDefault() {
        provisioning.clearPlatformDefault();
        LlmProvider source = repo.save(LlmProvider.builder()
            .userId(ADMIN_ACCOUNT)
            .type(LlmType.GROQ)
            .modelId("qwen/qwen3.8-27b")
            .encryptedApiKey("iv:ciphertext")
            .primary(true)
            .active(true)
            .build());
        return provisioning.setPlatformDefault(source);
    }

    @Test
    @DisplayName("Le provider provisionné depuis un appelant en lecture seule est bien écrit en base")
    void provisionFromReadOnlyCallerIsPersisted() {
        seedPlatformDefault();

        Optional<LlmProvider> returned = caller.provisionAsReadOnlyCaller(NEW_ACCOUNT);

        assertThat(returned).isPresent();

        // La relecture se fait par une transaction distincte : c'est le seul
        // moyen de constater qu'une écriture en FlushMode.MANUAL n'a jamais eu lieu.
        assertThat(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(NEW_ACCOUNT))
            .as("le provider doit exister réellement en base après l'appel")
            .hasSize(1);
    }

    @Test
    @DisplayName("La copie appartient au compte inscrit et n'est pas le défaut plateforme")
    void provisionedCopyBelongsToTheNewAccount() {
        seedPlatformDefault();

        LlmProvider copy = caller.provisionAsReadOnlyCaller(NEW_ACCOUNT).orElseThrow();

        assertThat(copy.getUserId()).isEqualTo(NEW_ACCOUNT);
        assertThat(copy.getModelId()).isEqualTo("qwen/qwen3.8-27b");
        assertThat(copy.getEncryptedApiKey()).isEqualTo("iv:ciphertext");
        assertThat(copy.isPrimary()).isTrue();
        assertThat(copy.isPlatformDefault()).isFalse();
    }

    @Test
    @DisplayName("Un second appel ne crée pas de doublon")
    void provisioningIsIdempotent() {
        seedPlatformDefault();

        caller.provisionAsReadOnlyCaller(NEW_ACCOUNT);
        caller.provisionAsReadOnlyCaller(NEW_ACCOUNT);

        assertThat(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(NEW_ACCOUNT))
            .hasSize(1);
    }

    @Test
    @DisplayName("Sans provider par défaut, rien n'est créé")
    void nothingIsCreatedWithoutPlatformDefault() {
        provisioning.clearPlatformDefault();

        assertThat(caller.provisionAsReadOnlyCaller(NEW_ACCOUNT)).isEmpty();

        assertThat(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(NEW_ACCOUNT))
            .isEmpty();
    }

    /**
     * Garde-fou sur l'annotation elle-même : si quelqu'un retire
     * {@code REQUIRES_NEW}, le test dtegration ci-dessus le rattrape, mais
     * seulement sur une base de test. Ce rappel explicite documente pourquoi
     * la propagation n'est pas optionnelle.
     */
    @Test
    @DisplayName("ensureDefaultProviderFor exige sa propre transaction")
    void provisioningMustRunInItsOwnTransaction() throws NoSuchMethodException {
        Propagation propagation = LlmProviderProvisioningService.class
            .getMethod("ensureDefaultProviderFor", String.class)
            .getAnnotation(Transactional.class)
            .propagation();

        assertThat(propagation)
            .as("REQUIRES_NEW est requis : un appelant readOnlyFlushMode.MANUAL et l'INSERT est perdu")
            .isEqualTo(Propagation.REQUIRES_NEW);
    }
}