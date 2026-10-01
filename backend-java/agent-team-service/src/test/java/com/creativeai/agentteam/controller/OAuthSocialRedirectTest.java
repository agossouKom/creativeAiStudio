package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.creativeai.agentteam.service.UserSocialAccountService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Cible de la redirection navigateur au retour du callback OAuth.
 *
 * <p>Le chemin est une valeur d'administrateur, saisie dans une variable
 * d'environnement : une faute de frappe (chaîne vide, slash manquant, slash
 * final) produisait soit une URL relative — réinterprétée par le navigateur
 * relativement à la page courante — soit un double slash. La normalisation est
 * donc verrouillée ici, route par route.
 */
class OAuthSocialRedirectTest {

    private OAuthSocialController controller;

    @BeforeEach
    void setUp() {
        controller = new OAuthSocialController(
            mock(ChannelService.class), mock(ChannelRepository.class), mock(AgentRepository.class),
            mock(EncryptionService.class), new OAuthStateStore(600, 1000), new ObjectMapper(),
            mock(SocialPlatformConfigService.class), mock(UserSocialAccountService.class));
    }

    private String returnPathFor(String configured) {
        ReflectionTestUtils.setField(controller, "frontendOAuthReturnPath", configured);
        return ReflectionTestUtils.invokeMethod(controller, "returnPath");
    }

    @Test
    void leCheminParDefautVaVersLaRouteQuiExisteDansLeFrontend() {
        // /generation/studio est la route réellement déclarée dans app.routes.ts
        // et qui lit oauth_success/oauth_error. /agentique/reseaux n'existe pas :
        // c'était la valeur codée en dur, d'où un 404 après connexion.
        assertThat(returnPathFor(null)).isEqualTo("/generation/studio");
    }

    @Test
    void unCheminSansSlashInitialEstCorrige() {
        assertThat(returnPathFor("generation/studio")).isEqualTo("/generation/studio");
    }

    @Test
    void lesSlashsFinalsSontSupprimes() {
        assertThat(returnPathFor("/generation/studio///")).isEqualTo("/generation/studio");
    }

    @Test
    void uneValeurVideOuBlancheRetombeSurLaRouteDuStudio() {
        // Une variable d'environnement présente mais vide est le cas le plus
        // probable en prod : l'utilisateur doit quand même revenir dans l'app.
        assertThat(returnPathFor("")).isEqualTo("/generation/studio");
        assertThat(returnPathFor("   ")).isEqualTo("/generation/studio");
    }

    @Test
    void laRacineResteLaRacine() {
        assertThat(returnPathFor("/")).isEqualTo("/");
    }

    @Test
    void unCheminExpliciteEstRespecteTelQuel() {
        assertThat(returnPathFor("/agentique/reseaux")).isEqualTo("/agentique/reseaux");
    }
}
