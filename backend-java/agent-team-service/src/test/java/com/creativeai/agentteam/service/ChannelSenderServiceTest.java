package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChannelSenderServiceTest {

    @Mock private ChannelRepository    channelRepo;
    @Mock private InboxService         inboxService;
    @Mock private EncryptionService    encryptionService;
    @Mock private JavaMailSender       mailSender;
    @Mock private WebClient.Builder    webClientBuilder;
    @Mock private MinioService         minioService;
    @Mock private MediaSecurityService mediaSecurity;
    @Mock private InstagramService     instagramService;
    @Mock private SocialPlatformConfigService platformConfig;

    private ChannelSenderService service;

    @BeforeEach
    void setUp() {
        service = new ChannelSenderService(channelRepo, inboxService, encryptionService, mailSender,
            webClientBuilder, new ObjectMapper(), minioService, mediaSecurity, instagramService, platformConfig);
        when(platformConfig.graphBaseUrl(anyString())).thenReturn("https://graph.facebook.com/v24.0");
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((jakarta.mail.Session) null));
        when(channelRepo.findByAgentIdAndDeletedFalse(any())).thenReturn(List.of());
    }

    private Channel channel(ChannelStatus status, PlatformType platform) {
        Channel channel = new Channel();
        channel.setType(ChannelType.SOCIAL_MEDIA);
        channel.setPlatformType(platform);
        channel.setStatus(status);
        channel.setAccountId("account-1");
        return channel;
    }

    @Test
    void refusesToPublishWhenNoChannelIsConnected() {
        when(channelRepo.findByAgentIdAndDeletedFalse("agent-1"))
            .thenReturn(List.of(channel(ChannelStatus.DISCONNECTED, PlatformType.INSTAGRAM)));

        ChannelSenderService.SendResult result =
            service.postSocial("user@test.dev", "agent-1", "INSTAGRAM", "ma légende", List.of());

        assertThat(result.success()).isFalse();
        assertThat(result.messageId()).isNull();
        assertThat(result.error()).contains("INSTAGRAM").contains("connecté");
    }

    @Test
    void refusesToPublishWhenOnlyAnotherPlatformIsConnected() {
        when(channelRepo.findByAgentIdAndDeletedFalse("agent-1"))
            .thenReturn(List.of(channel(ChannelStatus.CONNECTED, PlatformType.FACEBOOK)));

        ChannelSenderService.SendResult result =
            service.postSocial("user@test.dev", "agent-1", "INSTAGRAM", "ma légende", List.of());

        assertThat(result.success()).isFalse();
        assertThat(result.error()).contains("Aucun canal INSTAGRAM");
    }

    @Test
    void doesNotArchiveToInboxWhenPublicationIsRefused() {
        service.postSocial("user@test.dev", "agent-1", "FACEBOOK", "hello", List.of());

        verify(inboxService, never()).createMessage(any(), any());
    }
}
