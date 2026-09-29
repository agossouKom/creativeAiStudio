package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.SocialPlatformRequest;
import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Verrouille l'administration des réseaux sociaux d'entreprise.
 *
 * <p>Trois invariants qui ne se voient pas à la lecture du contrôleur :
 *   1. chaque endpoint porte bien {@code @PreAuthorize("hasRole('ADMIN')")} —
 *      l'annotation peut être retirée par erreur sans que rien ne casse à la
 *      compilation, seulement en production ;
 *   2. le secret applicatif est en écriture seule : le renvoyer par l'API, ou
 *      l'effacer quand l'admin corrige un simple libellé, casserait soit la
 *      sécurité soit les connexions existantes ;
 *   3. une plateforme rattachée à des comptes utilisateur ne peut ni être
 *      supprimée ni désactivée, sinon les comptes deviennent orphelins.
 */
@ExtendWith(MockitoExtension.class)
class AdminSocialControllerTest {

    @Mock private SocialPlatformRepository platformRepository;
    @Mock private UserSocialAccountRepository accountRepository;
    @Mock private SocialPlatformConfigService configService;
    @Mock private EncryptionService encryptionService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AdminSocialController controller;

    private static SocialPlatform platform(String id) {
        SocialPlatform sp = new SocialPlatform();
        sp.setId(id);
        sp.setDisplayName("Facebook");
        sp.setAuthType("oauth2");
        sp.setClientId("client-id");
        sp.setClientSecretEnc("chiffre:secret-en-clair-ne-doit-pas-sortir");
        return sp;
    }

    @BeforeEach
    void setUp() {
        controller = new AdminSocialController(platformRepository, accountRepository,
            configService, encryptionService, objectMapper);
        // Sur un mock, save() renvoie null ; le contrôleur lit l'entité renvoyée.
        // lenient() car seuls les tests d'écriture le déclenchent.
        lenient().doAnswer(inv -> inv.getArgument(0))
            .when(platformRepository).save(any(SocialPlatform.class));
    }

    // ── 1. Le rôle admin est bien exigé partout ─────────────────────────────

    @Test
    void chaqueEndpointAdminEstProtegeParLeRoleAdmin() throws Exception {
        List<Method> publics = List.of(
            AdminSocialController.class.getMethod("list"),
            AdminSocialController.class.getMethod("upsert", String.class, SocialPlatformRequest.class),
            AdminSocialController.class.getMethod("setActive", String.class, boolean.class),
            AdminSocialController.class.getMethod("delete", String.class),
            AdminSocialController.class.getMethod("reveal", String.class),
            AdminSocialController.class.getMethod("accounts", String.class, String.class, int.class, int.class));

        for (Method m : publics) {
            PreAuthorize preAuthorize = m.getAnnotation(PreAuthorize.class);
            assertThat(preAuthorize)
                .as("%s doit être protégé par @PreAuthorize", m.getName())
                .isNotNull();
            assertThat(preAuthorize.value())
                .as("%s doit exiger le rôle ADMIN", m.getName())
                .isEqualTo("hasRole('ADMIN')");
        }
    }

    // ── 2. Le secret ne sort jamais, et n'est jamais effacé par mégarde ─────

    @Test
    void leSecretApplicatifNestJamaisRenvoyeParLApi() {
        doReturn(List.of(platform("facebook"))).when(platformRepository).findAllByOrderBySortOrderAsc();
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "secret-en-clair", true))
            .when(configService).resolve("facebook");

        var reponse = controller.list();

        assertThat(reponse).hasSize(1);
        String serialise = reponse.get(0).toString();
        assertThat(serialise)
            .as("le secret ne doit apparaître dans aucune réponse")
            .doesNotContain("secret-en-clair");
        assertThat(reponse.get(0).isClientSecretConfigured())
            .as("l'écran a besoin de savoir qu'un secret existe, pas de le lire")
            .isTrue();
    }

    @Test
    void revelerNeRetourneQueLaPresenceDuSecretPasSaValeur() {
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "secret-en-clair", true))
            .when(configService).resolve("facebook");

        ResponseEntity<java.util.Map<String, Object>> reponse = controller.reveal("facebook");

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reponse.getBody())
            .as("le point « révéler » ne doit pas être une fuite de secret")
            .doesNotContainValue("secret-en-clair");
        assertThat(reponse.getBody()).containsKeys("clientId", "hasSecret", "fromDatabase");
    }

    @Test
    void unSecretVideALaModificationConserveCeluiEnPlace() {
        SocialPlatform sp = platform("facebook");
        doReturn(Optional.of(sp)).when(platformRepository).findById("facebook");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "chiffre:x", true))
            .when(configService).resolve("facebook");

        // L'admin corrige un libellé : le champ secret arrive vide depuis le
        // formulaire. Effacer le secret ici casserait toutes les connexions.
        controller.upsert("facebook", SocialPlatformRequest.builder()
            .id("facebook")
            .displayName("Facebook (Meta)")
            .clientSecret("")
            .build());

        assertThat(sp.getDisplayName()).isEqualTo("Facebook (Meta)");
        assertThat(sp.getClientSecretEnc())
            .as("le secret existant doit survivre à une édition sans secret")
            .isEqualTo("chiffre:secret-en-clair-ne-doit-pas-sortir");
        verify(encryptionService, never()).encrypt(any());
    }

    @Test
    void unSecretFourniEstChiffreAvantEnregistrement() {
        SocialPlatform sp = platform("facebook");
        doReturn(Optional.of(sp)).when(platformRepository).findById("facebook");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "x", true))
            .when(configService).resolve("facebook");
        doReturn("chiffre:nouveau").when(encryptionService).encrypt("nouveau-secret");

        controller.upsert("facebook", SocialPlatformRequest.builder()
            .id("facebook")
            .displayName("Facebook")
            .clientSecret("nouveau-secret")
            .build());

        ArgumentCaptor<SocialPlatform> captor = ArgumentCaptor.forClass(SocialPlatform.class);
        verify(platformRepository).save(captor.capture());
        assertThat(captor.getValue().getClientSecretEnc())
            .isEqualTo("chiffre:nouveau")
            .doesNotContain("nouveau-secret");
    }

    @Test
    void leDomaineEtLeCheminDeCallbackSontPersistes() {
        SocialPlatform sp = platform("facebook");
        doReturn(Optional.of(sp)).when(platformRepository).findById("facebook");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "x", true))
            .when(configService).resolve("facebook");

        controller.upsert("facebook", SocialPlatformRequest.builder()
            .id("facebook")
            .displayName("Facebook")
            .clientSecret("")
            .baseRedirectUrl("https://api.ai.labibpro.com")
            .callbackPath("/cb/facebook")
            .build());

        assertThat(sp.getBaseRedirectUrl()).isEqualTo("https://api.ai.labibpro.com");
        assertThat(sp.getCallbackPath()).isEqualTo("/cb/facebook");
        verify(platformRepository).save(sp);
    }

    @Test
    void unDomaineVideReinitialiseLeCallbackAURepliEnv() {
        SocialPlatform sp = platform("facebook");
        sp.setBaseRedirectUrl("https://ancien.domaine.com");
        doReturn(Optional.of(sp)).when(platformRepository).findById("facebook");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");
        doReturn(new SocialPlatformConfigService.Credentials("client-id", "x", true))
            .when(configService).resolve("facebook");

        controller.upsert("facebook", SocialPlatformRequest.builder()
            .id("facebook")
            .displayName("Facebook")
            .clientSecret("")
            .baseRedirectUrl("   ")
            .callbackPath(null)
            .build());

        assertThat(sp.getBaseRedirectUrl()).isNull();
        assertThat(sp.getCallbackPath()).isNull();
    }

    // ── 3. Une plateforme rattachée à des comptes est protégée ─────────────

    @Test
    void supprimerUnePlateformerattacheeADesComptesEstRefuse() {
        doReturn(3L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");

        ResponseEntity<?> reponse = controller.delete("facebook");

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(String.valueOf(reponse.getBody())).contains("3");
        verify(platformRepository, never()).deleteById(any());
    }

    @Test
    void desactiverUnePlateformerattacheeADesComptesEstRefuse() {
        doReturn(Optional.of(platform("facebook"))).when(platformRepository).findById("facebook");
        doReturn(2L).when(accountRepository).countByPlatform_IdAndDeletedFalse("facebook");

        ResponseEntity<?> reponse = controller.setActive("facebook", false);

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(platformRepository, never()).save(any());
    }

    @Test
    void desactiverUnePlateformerattacheeAAucunCompteEstAutorise() {
        SocialPlatform sp = platform("youtube");
        doReturn(Optional.of(sp)).when(platformRepository).findById("youtube");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("youtube");
        doReturn(new SocialPlatformConfigService.Credentials(null, null, false))
            .when(configService).resolve("youtube");

        ResponseEntity<?> reponse = controller.setActive("youtube", false);

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(sp.getIsActive()).isFalse();
    }

    @Test
    void desactiverUnePlateformeInconnueRepond404() {
        doReturn(Optional.empty()).when(platformRepository).findById("inconnu");

        assertThatThrownBy(() -> controller.setActive("inconnu", false))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode().value())
                .isEqualTo(404));
    }

    // ── 4. Cohérence de l'identifiant et des scopes ────────────────────────

    @Test
    void unIdentifiantDeCheminEtDeCorpsDivergentEstRefuse() {
        ResponseEntity<?> reponse = controller.upsert("facebook", SocialPlatformRequest.builder()
            .id("instagram")
            .displayName("Facebook")
            .build());

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(platformRepository, never()).save(any());
    }

    @Test
    void unePlateformeInexistanteEstCreeeEnMinuscules() {
        // Le contrôleur normalise l'identifiant avant la lecture : c'est ce qui
        // empêche un doublon « TikTok » à côté de « tiktok ».
        doReturn(Optional.empty()).when(platformRepository).findById("tiktok");
        doReturn(0L).when(accountRepository).countByPlatform_IdAndDeletedFalse("tiktok");
        doReturn(new SocialPlatformConfigService.Credentials(null, null, false))
            .when(configService).resolve("tiktok");

        controller.upsert("TikTok", SocialPlatformRequest.builder()
            .id("TikTok")
            .displayName("TikTok")
            .scopes(List.of("user.info.basic"))
            .build());

        ArgumentCaptor<SocialPlatform> captor = ArgumentCaptor.forClass(SocialPlatform.class);
        verify(platformRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("tiktok");
        assertThat(captor.getValue().getScopes()).contains("user.info.basic");
    }
}
