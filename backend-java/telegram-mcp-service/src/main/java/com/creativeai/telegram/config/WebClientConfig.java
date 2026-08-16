package com.creativeai.telegram.config;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        HttpClient http = HttpClient.create()
            .responseTimeout(Duration.ofSeconds(60))
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000);
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(http))
            .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024));
    }

    @Bean
    public WebClient telegramWebClient(WebClient.Builder builder, AppProperties props) {
        return builder
            .baseUrl("https://api.telegram.org/bot" + props.telegram().botToken())
            .build();
    }

    @Bean
    public WebClient agentTeamWebClient(WebClient.Builder builder, AppProperties props) {
        return builder
            .baseUrl(props.agentTeamBaseUrl())
            .build();
    }

    @Bean
    public WebClient authServiceWebClient(WebClient.Builder builder, AppProperties props) {
        return builder
            .baseUrl(props.authServiceBaseUrl())
            .build();
    }
}
