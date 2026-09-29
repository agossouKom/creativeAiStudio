package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserSocialAccountServiceTest {

    @Mock private UserSocialAccountRepository accountRepository;
    @Mock private SocialPlatformRepository platformRepository;
    @Mock private EncryptionService encryptionService;
    @Mock private SocialPlatformConfigService configService;

    private UserSocialAccountService service;

    private static SocialPlatform activePlatform(String id) {
        SocialPlatform sp = new SocialPlatform();
        sp.setId(id);
        sp.setDisplayName("Facebook");
        sp.setIsActive(true);
        return sp;
    }

    @BeforeEach
    void setUp() {
        service = new UserSocialAccountService(accountRepository, platformRepository,
            encryptionService, configService, new ObjectMapper());
        lenient().doReturn("facebook").when(configService).resolvePlatformId(any());
        // Sur un mock, save() renvoie null ; le service relit l'entité renvoyée.
        lenient().doAnswer(inv -> inv.getArgument(0))
            .when(accountRepository).save(any(UserSocialAccount.class));
    }

    @Test
    void premiereConnexionCreeLeCompteEtChiffreLeJeton() {
        doReturn(Optional.of(activePlatform("facebook"))).when(platformRepository).findById("facebook");
        doReturn(Optional.empty()).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse("u@x", "facebook", "page-1");
        doReturn("chiffre:jeton").when(encryptionService).encrypt("{\"userAccessToken\":\"x\"}");

        UserSocialAccount saved = service.recordFromOauth("u@x", "FACEBOOK", "page-1",
            "Ma Page", "{\"userAccessToken\":\"x\"}", List.of("pages_show_list"));

        assertThat(saved).isNotNull();
        assertThat(saved.getUserId()).isEqualTo("u@x");
        assertThat(saved.getPlatformAccountId()).isEqualTo("page-1");
        assertThat(saved.getPlatformAccountName()).isEqualTo("Ma Page");
        assertThat(saved.getStatus()).isEqualTo("CONNECTED");
        assertThat(saved.getAccessTokenEnc())
            .isEqualTo("chiffre:jeton")
            .as("le jeton ne doit jamais être stocké en clair")
            .doesNotContain("userAccessToken");
        assertThat(saved.grantedScopeList()).containsExactly("pages_show_list");
    }

    @Test
    void reconnecterLeMemeCompteLeMetAJourAuLieuDeLeDupliquer() {
        // La clé unique (user, plateforme, compte) est partielle sur deleted=false :
        // insérer une seconde ligne ferait échouer la connexion en 500. Le
        // upsert doit donc réutiliser l'existant.
        UserSocialAccount existant = new UserSocialAccount();
        existant.setUserId("u@x");
        existant.setPlatform(activePlatform("facebook"));
        existant.setPlatformAccountId("page-1");
        existant.setPlatformAccountName("Ancien nom");

        doReturn(Optional.of(activePlatform("facebook"))).when(platformRepository).findById("facebook");
        doReturn(Optional.of(existant)).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse("u@x", "facebook", "page-1");
        doReturn("chiffre:nouveau").when(encryptionService).encrypt("{}");

        UserSocialAccount saved = service.recordFromOauth("u@x", "FACEBOOK", "page-1",
            "Nouveau nom", "{}", null);

        assertThat(saved).isSameAs(existant);
        assertThat(saved.getPlatformAccountName()).isEqualTo("Nouveau nom");
        // Une seule écriture, et sur l'instance existante : c'est ce qui évite
        // une seconde ligne qui violerait la clé unique partielle.
        ArgumentCaptor<UserSocialAccount> captor = ArgumentCaptor.forClass(UserSocialAccount.class);
        verify(accountRepository).save(captor.capture());
        assertThat(captor.getValue()).isSameAs(existant);
    }

    @Test
    void unComptePrecedentEnErreurRevientAConnecte() {
        UserSocialAccount existant = new UserSocialAccount();
        existant.setUserId("u@x");
        existant.setPlatform(activePlatform("facebook"));
        existant.setPlatformAccountId("page-1");
        existant.setStatus("ERROR");
        existant.setLastError("ancien échec");

        doReturn(Optional.of(activePlatform("facebook"))).when(platformRepository).findById("facebook");
        doReturn(Optional.of(existant)).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse("u@x", "facebook", "page-1");
        doReturn("chiffre:x").when(encryptionService).encrypt("{}");

        UserSocialAccount saved = service.recordFromOauth("u@x", "FACEBOOK", "page-1", "Page", "{}", null);

        assertThat(saved.getStatus()).isEqualTo("CONNECTED");
        assertThat(saved.getLastError()).isNull();
    }

    @Test
    void unePlateformeInconnueNeBloquePasLaConnexion() {
        doReturn(Optional.empty()).when(platformRepository).findById("facebook");

        assertThat(service.recordFromOauth("u@x", "FACEBOOK", "page-1", "Page", "{}", null))
            .as("le canal reste connecté même si l'admin n'a pas créé la ligne")
            .isNull();
        verify(accountRepository, never()).save(any(UserSocialAccount.class));
    }

    @Test
    void unePlateformeDesactiveeNEnregistrePasLeCompte() {
        SocialPlatform desactivee = activePlatform("facebook");
        desactivee.setIsActive(false);
        doReturn(Optional.of(desactivee)).when(platformRepository).findById("facebook");

        assertThat(service.recordFromOauth("u@x", "FACEBOOK", "page-1", "Page", "{}", null)).isNull();
        verify(accountRepository, never()).save(any(UserSocialAccount.class));
    }

    @Test
    void unCompteSansIdentifiantReseauEstIgnore() {
        assertThat(service.recordFromOauth("u@x", "FACEBOOK", "", "Page", "{}", null)).isNull();
        assertThat(service.recordFromOauth("u@x", "FACEBOOK", null, "Page", "{}", null)).isNull();
        verify(platformRepository, never()).findById(any());
        verify(accountRepository, never()).save(any(UserSocialAccount.class));
    }

    @Test
    void unEchecDeChiffrementMarqueLErreurSansPropager() {
        // Le canal a déjà été écrit avec les mêmes credentials : une exception
        // ici ferait perdre une connexion qui fonctionnait. Si l'appel
        // propageait, le test échouerait sur l'exception.
        doReturn(Optional.of(activePlatform("facebook"))).when(platformRepository).findById("facebook");
        doThrow(new IllegalStateException("clé absente")).when(encryptionService).encrypt(any());

        UserSocialAccount saved = service.recordFromOauth("u@x", "FACEBOOK", "page-1", "Page", "{}", null);

        assertThat(saved).isNotNull();
        assertThat(saved.getStatus()).isEqualTo("ERROR");
        assertThat(saved.getLastError()).contains("Chiffrement");
        assertThat(saved.isUsable()).isFalse();
    }

    @Test
    void deconnecterArchiveLeCompteEtEffaceLeJeton() {
        UserSocialAccount existant = new UserSocialAccount();
        existant.setUserId("u@x");
        existant.setPlatform(activePlatform("facebook"));
        existant.setPlatformAccountId("page-1");
        existant.setAccessTokenEnc("chiffre:jeton");
        doReturn(Optional.of(existant)).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse("u@x", "facebook", "page-1");

        service.disconnect("u@x", "FACEBOOK", "page-1");

        assertThat(existant.isDeleted()).isTrue();
        assertThat(existant.getStatus()).isEqualTo("DISCONNECTED");
        assertThat(existant.getAccessTokenEnc())
            .as("un jeton d'un compte déconnecté ne doit pas rester en base")
            .isNull();
    }

    @Test
    void deconnecterUnCompteInconnuNeLevePas() {
        doReturn(Optional.empty()).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse("u@x", "facebook", "page-1");

        assertThatCode(() -> service.disconnect("u@x", "FACEBOOK", "page-1"))
            .doesNotThrowAnyException();
    }

    @Test
    void instagramPartageLaPlateformeFacebook() {
        doReturn("facebook").when(configService).resolvePlatformId("INSTAGRAM");
        doReturn(Optional.of(activePlatform("facebook"))).when(platformRepository).findById("facebook");
        doReturn(Optional.empty()).when(accountRepository)
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse(any(), any(), any());
        doReturn("chiffre:x").when(encryptionService).encrypt("{}");

        UserSocialAccount saved = service.recordFromOauth("u@x", "INSTAGRAM", "ig-1", "IG", "{}", null);

        assertThat(saved.getPlatform().getId()).isEqualTo("facebook");
    }
}
