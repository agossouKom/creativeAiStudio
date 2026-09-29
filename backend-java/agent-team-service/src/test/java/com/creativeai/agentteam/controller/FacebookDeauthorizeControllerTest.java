package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.UserSocialAccount;
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
 *      lieu côté l'application).
 */
@ExtendWith(MockitoExtension.class)
class FacebookDeauthorizeControllerTest {

    private static final String APP_SECRET = "super-secret-meta";
    private static final String META_USER = "911234567890";

    @Mock private SocialPlatformConfigService configService;
    @Mock private UserSocialAccountRepository accountRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private FacebookDeauthorizeController controller;

    @BeforeEach
    void setUp() {
        controller = new FacebookDeauthorizeController(configService, accountRepository, objectMapper);
        lenient().doAnswer(inv -> inv.getArgument(0))
            .when(accountRepository).save(any(UserSocialAccount.class));
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