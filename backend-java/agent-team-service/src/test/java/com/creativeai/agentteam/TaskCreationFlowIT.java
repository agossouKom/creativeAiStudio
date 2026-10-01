package com.creativeai.agentteam;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.SubscriptionUsage;
import com.creativeai.agentteam.model.UserSubscription;
import com.creativeai.agentteam.model.enums.SubscriptionPlan;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.SubscriptionUsageRepository;
import com.creativeai.agentteam.repository.TaskExecutionEventRepository;
import com.creativeai.agentteam.repository.UserSubscriptionRepository;
import com.creativeai.agentteam.service.ExecutionHistoryService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.minio.MinioClient;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.*;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests d'intégration E2E — flux critique : création de tâche → quotas → historique.
 *
 * Infrastructure : PostgreSQL via Testcontainers (Flyway V1-V7 appliqués automatiquement).
 * Services externes mockés : Redis, Kafka, MinIO, JavaMailSender.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TaskCreationFlowIT {

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

    // ── Mocks pour services externes ──────────────────────────────────────────
    // Redis : les deux factories doivent être mockées. LettuceConnectionFactory
    // (le bean auto-configuré) implémente À LA FOIS RedisConnectionFactory et
    // ReactiveRedisConnectionFactory ; le mocker par le premier type le supprime
    // donc aussi du contexte pour le second, et reactiveRedisTemplate échoue
    // alors au démarrage sur « No qualifying bean of type
    // ReactiveRedisConnectionFactory ».
    @MockBean RedisConnectionFactory        redisConnectionFactory;
    @MockBean ReactiveRedisConnectionFactory reactiveRedisConnectionFactory;
    @MockBean KafkaTemplate<Object,Object>  kafkaTemplate;
    @MockBean JavaMailSender                javaMailSender;
    @MockBean MinioClient                   minioClient;

    // ── Collaborateurs injectés ───────────────────────────────────────────────
    @Autowired TestRestTemplate             restTemplate;
    @Autowired UserSubscriptionRepository   subRepo;
    @Autowired SubscriptionUsageRepository  usageRepo;
    @Autowired TaskExecutionEventRepository eventRepo;
    @Autowired ExecutionHistoryService      historyService;

    @Value("${agent.jwt-secret}")
    private String jwtSecret;

    private static final String TEST_USER_ID = "user-test-e2e-001";

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateJwt(String userId) {
        return Jwts.builder()
            .subject(userId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + 3_600_000L))
            .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }

    private HttpHeaders authHeaders(String userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(generateJwt(userId));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private ResponseEntity<Map> postTask(String userId, String title) {
        CreateTaskRequest body = new CreateTaskRequest(
            title, "Description E2E", TaskType.GENERAL, null, null, null,
            null, null, null, null, null, null, null, false,
            null, null, null, null, null
        );
        return restTemplate.exchange(
            "/api/tasks",
            HttpMethod.POST,
            new HttpEntity<>(body, authHeaders(userId)),
            Map.class
        );
    }

    @BeforeEach
    void cleanup() {
        usageRepo.deleteAll();
        subRepo.deleteAll();
        eventRepo.deleteAll();
    }

    // ── Scénario 1 : création de tâche → 201 ─────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("POST /api/tasks → 201 Created avec plan FREE auto-créé")
    void taskCreation_shouldReturn201_andAutoCreateFreeSubscription() {
        ResponseEntity<Map> response = postTask(TEST_USER_ID, "Tâche E2E #1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsKey("id");

        // Le plan FREE doit avoir été créé automatiquement
        assertThat(subRepo.findByUserId(TEST_USER_ID)).isPresent()
            .get().extracting(UserSubscription::getPlan).isEqualTo(SubscriptionPlan.FREE);
    }

    // ── Scénario 2 : compteur de quota incrémenté ─────────────────────────────

    @Test
    @Order(2)
    @DisplayName("POST /api/tasks → compteur usage mensuel = 1 (après flush @Async)")
    void taskCreation_shouldIncrementMonthlyUsage() {
        postTask(TEST_USER_ID, "Tâche quota #1");

        String period = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        // incrementTaskUsage est @Async — on attend la persistance
        Awaitility.await().atMost(3, TimeUnit.SECONDS)
            .until(() -> usageRepo.findByUserIdAndPeriod(TEST_USER_ID, period).isPresent());

        assertThat(usageRepo.findByUserIdAndPeriod(TEST_USER_ID, period))
            .isPresent()
            .get().extracting(SubscriptionUsage::getTasksUsed).isEqualTo(1);
    }

    // ── Scénario 3 : dépassement de quota → 402 ──────────────────────────────

    @Test
    @Order(3)
    @DisplayName("POST /api/tasks quand quota FREE épuisé → 402 Payment Required")
    void taskCreation_whenFreeQuotaExceeded_shouldReturn402() {
        // Prépare : abonnement FREE avec 50/50 tâches utilisées ce mois
        subRepo.save(UserSubscription.builder()
            .userId(TEST_USER_ID)
            .plan(SubscriptionPlan.FREE)
            .tasksPerMonth(50)
            .maxAgents(3)
            .maxTeams(1)
            .premiumLlmEnabled(false)
            .build());
        String period = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        usageRepo.save(SubscriptionUsage.builder()
            .userId(TEST_USER_ID)
            .period(period)
            .tasksUsed(50)
            .build());

        // Tente de créer une 51ème tâche
        ResponseEntity<Map> response = postTask(TEST_USER_ID, "Tâche qui dépasse le quota");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.PAYMENT_REQUIRED);
        // Le corps est un ProblemDetail (RFC 9457) : les propriétés métier
        // posées par GlobalExceptionHandler.handleQuotaExceeded (used, limit,
        // plan) sont imbriquées sous "properties", pas à plat. L'assertion
        //cherchait "plan" à la racine, donc échouait sur une réponse correcte.
        assertThat(response.getBody())
            .containsEntry("title", "Payment Required")
            .containsKey("properties");
        assertThat((Map<String, Object>) response.getBody().get("properties"))
            .containsEntry("plan", "FREE")
            .containsEntry("used", 50)
            .containsEntry("limit", 50);
    }

    // ── Scénario 4 : historique d'exécution — événements EMAIL_SENT ──────────

    @Test
    @Order(4)
    @DisplayName("ExecutionHistoryService.logEmailSent persiste l'événement EMAIL_SENT")
    void emailSent_shouldBePersistedInExecutionHistory() throws InterruptedException {
        String taskId = "task-e2e-" + System.currentTimeMillis();

        historyService.logTaskStarted(taskId, "agent-01", TEST_USER_ID);
        historyService.logEmailSent(taskId, "agent-01", TEST_USER_ID,
            "client@example.com", "Suivi de votre commande", "msg-001");
        historyService.logTaskCompleted(taskId, "agent-01", TEST_USER_ID, "Email envoyé avec succès");

        // @Async — attendre que les threads async aient persisté les événements
        Awaitility.await().atMost(3, TimeUnit.SECONDS)
            .until(() -> eventRepo.findByTaskIdOrderByCreatedAtAsc(taskId).size() == 3);

        var timeline = eventRepo.findByTaskIdOrderByCreatedAtAsc(taskId);
        assertThat(timeline).hasSize(3);
        // Les trois log* sont @Async et s'exécutent sur des threads distincts :
        // rien ne garantit leur ordre d'insertion. containsExactly imposait un
        // ordre que le code ne promet pas. On vérifie le contenu de la
        // timeline, pas sa séquence.
        assertThat(timeline).extracting(e -> e.getEventType())
            .containsExactlyInAnyOrder("TASK_STARTED", "EMAIL_SENT", "TASK_COMPLETED");

        var emailEvent = timeline.stream()
            .filter(e -> "EMAIL_SENT".equals(e.getEventType()))
            .findFirst().orElseThrow();
        assertThat(emailEvent.getToolName()).isEqualTo("send_email");
        assertThat(emailEvent.getEventData()).contains("client@example.com");
    }

    // ── Scénario 5 : endpoint usage retourne les bonnes métriques ────────────

    @Test
    @Order(5)
    @DisplayName("GET /api/subscription/usage retourne les métriques correctes")
    void subscriptionUsage_shouldReturnCorrectMetrics() {
        postTask(TEST_USER_ID, "Tâche métriques #1");
        postTask(TEST_USER_ID, "Tâche métriques #2");

        ResponseEntity<Map> response = restTemplate.exchange(
            "/api/subscription/usage",
            HttpMethod.GET,
            new HttpEntity<>(authHeaders(TEST_USER_ID)),
            Map.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .containsEntry("plan", "FREE")
            .containsEntry("tasksPerMonth", 50);
        assertThat((Integer) response.getBody().get("tasksUsed")).isGreaterThanOrEqualTo(2);
    }
}
