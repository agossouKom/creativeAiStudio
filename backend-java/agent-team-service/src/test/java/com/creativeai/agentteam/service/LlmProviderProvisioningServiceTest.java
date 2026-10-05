package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Couvre l'assignation automatique du provider par défaut de la plateforme.
 *
 * <p>Le scénario métier : un administrateur crée un provider, le marque par
 * défaut, et tout compte sans provider le reçoit automatiquement — c'est ce qui
 * permet à un utilisateur inscrit de chatter immédiatement, et à un compte
 * antérieur à la mise en place du mécanisme de rattraper son retard.
 */
class LlmProviderProvisioningServiceTest {

    private LlmProviderRepository repo;
    private LlmProviderProvisioningService service;

    @BeforeEach
    void setUp() {
        repo = mock(LlmProviderRepository.class);
        service = new LlmProviderProvisioningService(repo);
        setAdminUserId("admin@creativeai.com");
    }

    private void setAdminUserId(String value) {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "adminUserId", value);
    }

    /** L'id vit dans BaseEntity, hors du builder Lombok : il est posé après coup. */
    private static LlmProvider withId(LlmProvider provider, String id) {
        provider.setId(id);
        return provider;
    }

    private LlmProvider platformDefault(String id, String modelId) {
        return withId(LlmProvider.builder()
            .userId("admin@creativeai.com")
            .type(LlmType.GROQ)
            .modelId(modelId)
            .encryptedApiKey("iv:ciphertext")
            .primary(true)
            .active(true)
            .platformDefault(true)
            .build(), id);
    }

    @Test
    @DisplayName("Un compte sans provider reçoit une copie du provider par défaut")
    void provisionsPlatformDefaultIntoEmptyAccount() {
        when(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("new@creativeai.com"))
            .thenReturn(List.of());
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.of(platformDefault("src", "qwen/qwen3.8-27b")));
        when(repo.save(any(LlmProvider.class))).thenAnswer(inv -> inv.getArgument(0));

        Optional<LlmProvider> result = service.ensureDefaultProviderFor("new@creativeai.com");

        assertThat(result).isPresent();
        LlmProvider copy = result.orElseThrow();

        // La copie est rattachée au compte, pas au compte admin : c'est ce qui
        // permet à l'utilisateur de la modifier ou de la supprimer.
        assertThat(copy.getUserId()).isEqualTo("new@creativeai.com");
        assertThat(copy.getModelId()).isEqualTo("qwen/qwen3.8-27b");
        assertThat(copy.getEncryptedApiKey()).isEqualTo("iv:ciphertext");
        assertThat(copy.isPrimary()).isTrue();
        assertThat(copy.isActive()).isTrue();

        // La copie ne doit pas être elle-même le provider par défaut de la
        // plateforme : sinon l'index unique partiel la refusé.
        assertThat(copy.isPlatformDefault()).isFalse();
    }

    @Test
    @DisplayName("Un compte qui a déjà un provider n'est jamais écrasé")
    void doesNotTouchAccountThatAlreadyHasProvider() {
        LlmProvider existing = withId(LlmProvider.builder()
            .userId("user@creativeai.com")
            .type(LlmType.OPENAI).modelId("gpt-4o-mini").active(true).build(), "own");
        when(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("user@creativeai.com"))
            .thenReturn(List.of(existing));

        assertThat(service.ensureDefaultProviderFor("user@creativeai.com")).isEmpty();

        verify(repo, never()).save(any(LlmProvider.class));
        verify(repo, never()).findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse();
    }

    @Test
    @DisplayName("Sans provider par défaut, un compte reste sans provider plutôt que de recevoir une clé arbitraire")
    void doesNothingWhenNoPlatformDefaultConfigured() {
        when(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("user@creativeai.com"))
            .thenReturn(List.of());
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.empty());

        assertThat(service.ensureDefaultProviderFor("user@creativeai.com")).isEmpty();

        verify(repo, never()).save(any(LlmProvider.class));
    }

    @Test
    @DisplayName("Marquer un provider par défaut retire le statut du précédent")
    void setPlatformDefaultClearsPreviousFlag() {
        LlmProvider previous = platformDefault("old", "gpt-oss-20b");
        LlmProvider chosen    = withId(LlmProvider.builder()
            .userId("admin@creativeai.com")
            .type(LlmType.GROQ).modelId("qwen/qwen3.8-27b").active(true).build(), "new");
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.of(previous));
        when(repo.save(any(LlmProvider.class))).thenAnswer(inv -> inv.getArgument(0));

        LlmProvider result = service.setPlatformDefault(chosen);

        // L'index unique partiel en base interdit deux providers par défaut :
        // le drapeau du précédent doit donc être retiré avant d'en poser un autre.
        assertThat(previous.isPlatformDefault()).isFalse();
        assertThat(result.isPlatformDefault()).isTrue();
        verify(repo).save(previous);
        verify(repo).save(chosen);
    }

    @Test
    @DisplayName("Ré-marquer le provider déjà par défaut ne le désactive pas")
    void setPlatformDefaultIsIdempotentOnSameProvider() {
        LlmProvider chosen = platformDefault("same", "qwen/qwen3.8-27b");
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.of(chosen));
        when(repo.save(any(LlmProvider.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setPlatformDefault(chosen);

        assertThat(chosen.isPlatformDefault()).isTrue();
        // Une seule sauvegarde : inutile de réécrire le provider inchangé.
        verify(repo).save(chosen);
    }

    @Test
    @DisplayName("L'héritage sans provider par défaut retombe sur le provider du compte admin")
    void inheritedDefaultFallsBackToAdminAccount() {
        setAdminUserId("admin@creativeai.com");
        LlmProvider adminProvider = withId(LlmProvider.builder()
            .userId("admin@creativeai.com")
            .type(LlmType.GROQ).modelId("gpt-oss-20b").primary(true).active(true).build(), "admin-l");
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.empty());
        when(repo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("admin@creativeai.com"))
            .thenReturn(List.of(adminProvider));

        assertThat(service.resolveInheritedDefault("user@creativeai.com"))
            .containsSame(adminProvider);
    }

    @Test
    @DisplayName("Le provider par défaut de plateforme prime sur le compte admin")
    void platformDefaultWinsOverAdminAccount() {
        LlmProvider platform = platformDefault("src", "qwen/qwen3.8-27b");
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.of(platform));

        assertThat(service.resolveInheritedDefault("user@creativeai.com"))
            .containsSame(platform);

        // Le repli admin ne doit même pas être consulté.
        verify(repo, never()).findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(anyString());
    }

    @Test
    @DisplayName("Un compte sans provider n'hérite pas de son propre provider via le repli admin")
    void adminDoesNotInheritFromItself() {
        setAdminUserId("admin@creativeai.com");
        when(repo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse())
            .thenReturn(Optional.empty());

        assertThat(service.resolveInheritedDefault("admin@creativeai.com")).isEmpty();

        verify(repo, never()).findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(anyString());
    }
}