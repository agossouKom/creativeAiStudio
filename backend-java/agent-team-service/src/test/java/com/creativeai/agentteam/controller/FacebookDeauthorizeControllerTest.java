package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verrouille le webhook <tt>/api/oauth/social/facebook/deauthorize</tt> :
 *   1. la signature HMAC-SHA256 du signed_request est exigée et comparée en
 *      temps constant (sinon n'importe qui pourrait purger des comptes) ;
 *   2. un user_id Meta valide déclenche la révocation des jetons. Il répond 200
 *      à Meta même si aucun compte local ne matche (la suppression a déjà eu
 *      lieu côté l'application) ;
 *   3. les canaux agents rattachés au compte sont eux aussi purgés : ils portent
 *      une copie des credentials, sinon le jeton révoqué continuerait d'être
 *      utilisé à la publication.
 */
@ExtendWith(MockitoExtension.class)
class FacebookDeauthorizeControllerTest {

    private static final String APP_SECRET = "super-secret-meta";
    private static final String META_USER = "911234567890";

    @Mock private SocialPlatformConfigService configService;
    @Mock private UserSocialAccountRepository accountRepository;
    @Mock private ChannelRepository channelRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private FacebookDeauthorizeController controller;

    @BeforeEach
    void setUp() {
        controller = new FacebookDeauthorizeController(
            configService, accountRepository, channelRepository, objectMapper);
        lenient().doAnswer(inv -> inv.getArgument(0))
            .when(accountRepository).save(any(UserSocialAccount.class));
        lenient().doAnswer(inv -> inv.getArgument(0))
            .when(channelRepository).save(any(Channel.class));
        lenient().when(channelRepository
            .findByAccountIdAndPlatformTypeAndDeletedFalse(anyString(), any()))
            .thenReturn(List.of());
    }

    @Test
    void signedRequestValidePurgeLesJetonsDUtilisateur() throws Exception {
        String body = signedRequest("HMAC-SHA256", META_USER);
        when(configService.resolve("FACEBOOK"))
            .thenReturn(new SocialPlatformConfigService.Credentials("app-1", APP_SECRET, false));

        UserSocialAccount a = account();
        when(accountRepository.findByMetaUserId(eq("facebook"), eq(META_USER)))
            .thenReturn(List.of(a));

        var reponse = controller.deauthorize(body);

        assertThat(reponse.getStatusCode().value()).isEqualTo(200);
        verify(accountRepository).findByMetaUserId("facebook", META_USER);
        verify(accountRepository).save(a);
        assertThat(a.isDeleted()).as("le compte est soft-deleté").isTrue();
        assertThat(a.getStatus()).isEqualTo("DISCONNECTED");
        assertThat(a.getAccessTokenEnc()).isNull();
        assertThat(a.getRefreshTokenEnc()).isNull();
    }

    @Test
    void lesCanauxDuCompteSontPurgesEtsPassesDisconnected() throws Exception {
        String body = signedRequest("HMAC-SHA256", META_USER);
        when(configService.resolve("FACEBOOK"))
            .thenReturn(new SocialPlatformConfigService.Credentials("app-1", APP_SECRET, false));
        when(accountRepository.findByMetaUserId(eq("facebook"), eq(META_USER)))
            .thenReturn(List.of(account()));

        Channel connectee = channel("page-1", ChannelStatus.CONNECTED);
        Channel expiree  = channel("page-1", ChannelStatus.EXPIRED);
        when(channelRepository.findByAccountIdAndPlatformTypeAndDeletedFalse(
                eq("page-1"), eq(PlatformType.FACEBOOK)))
            .thenReturn(List.of(connectee, expiree));

        controller.deauthorize(body);

        // Tous états confondus : un canal EXPIRED garde lui aussi un jeton mort.
        assertThat(connectee.getStatus()).isEqualTo(ChannelStatus.DISCONNECTED);
        assertThat(expiree.getStatus()).isEqualTo(ChannelStatus.DISCONNECTED);
        assertThat(connectee.getEncryptedCredentials())
            .as("credentials du canal purgées").isNull();
        assertThat(connectee.getTokenExpiresAt()).isNull();
        verify(channelRepository, atLeastOnce()).save(any(Channel.class));
    }

    @Test
    void aucunCompteMetaNeDeclencheAucuneRequeteSurLesCanaux() throws Exception {
        when(configService.resolve("FACEBOOK"))
            .thenReturn(new SocialPlatformConfigService.Credentials("app-1", APP_SECRET, false));
        when(accountRepository.findByMetaUserId(eq("facebook"), eq(META_USER)))
            .thenReturn(List.of());

        var reponse = controller.deauthorize(signedRequest("HMAC-SHA256", META_USER));

        assertThat(reponse.getStatusCode().value()).isEqualTo(200);
        verify(channelRepository, never())
            .findByAccountIdAndPlatformTypeAndDeletedFalse(anyString(), any());
    }

    @Test
    void signatureAltereeEstRefuseeSansToucherAuxComptes() throws Exception {
        String body = "signed_request=" + "cGluZyEyMzQ" + "." + Base64.getUrlEncoder().withoutPadding()
            .encodeToString("signature bidon".getBytes(StandardCharsets.UTF_8));
        when(configService.resolve("FACEBOOK"))
            .thenReturn(new SocialPlatformConfigService.Credentials("app-1", APP_SECRET, false));

        var reponse = controller.deauthorize(body);

        assertThat(reponse.getStatusCode().value()).isEqualTo(401);
        verify(accountRepository, never()).findByMetaUserId(anyString(), anyString());
    }

    @Test
    void signedRequestSansPointEstRefuse() {
        var reponse = controller.deauthorize("signed_request=" + "aaa");

        assertThat(reponse.getStatusCode().value()).isEqualTo(400);
        verify(accountRepository, never()).findByMetaUserId(anyString(), anyString());
    }

    @Test
    void aucunSecretConfigureRetourne503() throws Exception {
        when(configService.resolve("FACEBOOK"))
            .thenReturn(new SocialPlatformConfigService.Credentials(null, null, false));

        var reponse = controller.deauthorize(signedRequest("HMAC-SHA256", META_USER));

        assertThat(reponse.getStatusCode().value()).isEqualTo(503);
    }

    private Channel channel(String accountId, ChannelStatus status) {
        Channel c = new Channel();
        c.setId(java.util.UUID.randomUUID().toString());
        c.setStatus(status);
        c.setAccountId(accountId);
        c.setEncryptedCredentials("enc:page-token");
        c.setTokenExpiresAt(java.time.LocalDateTime.now().plusDays(30));
        return c;
    }

    private UserSocialAccount account() {
        UserSocialAccount a = new UserSocialAccount();
        a.setStatus("CONNECTED");
        a.setAccessTokenEnc("enc:token");
        a.setRefreshTokenEnc(null);
        a.setPlatformAccountId("page-1");
        return a;
    }

    /** Construit le signed_request exactement comme Meta : sig = HMAC(payload b64url). */
    private static String signedRequest(String algorithm, String userId) throws Exception {
        String payload = "{\"algorithm\":\"" + algorithm + "\",\"issued_at\":1234567890,"
            + "\"user_id\":\"" + userId + "\"}";
        String payloadB64 = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sig = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8)));
        return "signed_request=" + payloadB64 + "." + sig;
    }
}