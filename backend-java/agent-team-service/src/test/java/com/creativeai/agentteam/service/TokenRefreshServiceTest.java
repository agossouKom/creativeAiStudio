package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Verrouille le job de refresh des jetons :
 *   1. la passe quotidienne choisit les comptes proches de l'expiration et
 *      les renouvelle via le mécanisme du fournisseur ;
 *   2. un succès réécrit les credentials du compte ET ceux des channels
 *      connectés (le channel est ce que lit la publication) ;
 *   3. une plateforme sans refresh automatique (Twitter/X) est ignorée sans
 *      faire échouer les autres.
 */
@ExtendWith(MockitoExtension.class)
class TokenRefreshServiceTest {

    @Mock private UserSocialAccountRepository accountRepository;
    @Mock private ChannelRepository channelRepository;
    @Mock private SocialPlatformConfigService configService;
    @Mock private EncryptionService encryptionService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TokenRefreshService service;

    @BeforeEach
    void setUp() {
        service = new TokenRefreshService(accountRepository, channelRepository,
            configService, encryptionService, objectMapper);
        lenient().doAnswer(inv -> "enc:" + inv.getArgument(0))
            .when(encryptionService).encrypt(anyString());
        lenient().doReturn("{\"userAccessToken\":\"u-tok\",\"accessToken\":\"page-tok\"}")
            .when(encryptionService).decrypt(anyString());
    }

    @Test
    void facebookEstProlongeViaFbExchangeTokenEtLeJetonDUtilisateurRemplace() throws Exception {
        UserSocialAccount account = facebookAccount();

        MockRestServiceServer server = MockRestServiceServer.bindTo(service.restTemplate).build();
        // La version vient de la configuration de la plateforme, plus d'un littéral
        // figé dans le code : on vérifie donc l'URL résolue, pas "v19.0".
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(
                "https://graph.facebook.com/v24.0/oauth/access_token")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("{\"access_token\":\"nouveau-long\",\"expires_in\":5184000}",
                org.springframework.http.MediaType.APPLICATION_JSON));

        lenient().doReturn(
            new SocialPlatformConfigService.Credentials("app-1", "sec", false))
            .when(configService).resolve("FACEBOOK");
        lenient().when(configService.graphBaseUrl("FACEBOOK"))
            .thenReturn("https://graph.facebook.com/v24.0");

        Channel ch = new Channel();
        ch.setId("ch-1");
        ch.setEncryptedCredentials("enc:ancien-json");
        when(channelRepository.findByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
            eq("page-1"), eq(PlatformType.FACEBOOK), eq(ChannelStatus.CONNECTED)))
            .thenReturn(List.of(ch));

        service.refreshOne(account);

        server.verify();
        assertThat(account.getAccessTokenEnc()).isEqualTo("enc:" + "{\"userAccessToken\":\"nouveau-long\",\"accessToken\":\"page-tok\",\"expiresIn\":5184000}");
        assertThat(account.getNeedsRefresh()).isFalse();
        assertThat(account.getLastError()).isNull();
        assertThat(account.getTokenExpiresAt()).isNotNull();
        assertThat(account.getTokenExpiresAt()).isAfter(LocalDateTime.now());

        // Le channel porte le nouveau jeton, le moment exact où publier.
        ArgumentCaptor<Channel> chCaptor = ArgumentCaptor.forClass(Channel.class);
        verify(channelRepository).save(chCaptor.capture());
        assertThat(chCaptor.getValue().getEncryptedCredentials()).contains("nouveau-long");
    }

    @Test
    void laPasseQuotidienneIgnoreLesPlateformesSansRefresh() throws Exception {
        // Twitter/X ne délivre aucun refresh token : refreshOne doit sortir sans
        // aucun appel réseau ni modification du compte.
        SocialPlatform tw = new SocialPlatform();
        tw.setId("twitter_x");
        tw.setDisplayName("Twitter / X");
        UserSocialAccount account = new UserSocialAccount();
        account.setPlatform(tw);
        account.setPlatformAccountId("u-1");
        account.setStatus("CONNECTED");
        account.setNeedsRefresh(true);
        account.setAccessTokenEnc("enc:x");

        when(accountRepository.findRefreshCandidates(any(LocalDateTime.class)))
            .thenReturn(List.of(account));

        service.refreshExpiringTokens();

        verify(accountRepository, org.mockito.Mockito.never()).save(any());
    }

    private UserSocialAccount facebookAccount() {
        SocialPlatform fb = new SocialPlatform();
        fb.setId("facebook");
        fb.setDisplayName("Facebook");
        UserSocialAccount a = new UserSocialAccount();
        a.setPlatform(fb);
        a.setPlatformAccountId("page-1");
        a.setPlatformAccountName("Ma Page");
        a.setStatus("CONNECTED");
        a.setNeedsRefresh(true);
        a.setAccessTokenEnc("enc:ancien-json");
        return a;
    }
}