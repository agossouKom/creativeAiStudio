package com.creativeai.agentteam.security;

import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

// CORS géré exclusivement par l'API Gateway — pas de config CORS ici pour éviter
// la duplication des headers Access-Control-Allow-Origin qui bloque les navigateurs.
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Les dispatches ASYNC/ERROR (SSE, streaming) ne portent pas de JWT —
                // ils sont déjà authentifiés sur le dispatch REQUEST initial.
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                .requestMatchers(
                    "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
                    "/actuator/health", "/actuator/info",
                    // Callback OAuth : appelé par la plateforme via une redirection navigateur,
                    // sans JWT. La sécurité est portée par le `state` à usage unique lié à
                    // l'utilisateur qui a démarré le flow — PAS par un permitAll large.
                    "/api/oauth/social/*/callback",
                    // Webhooks entrants : authentifiés par leur propre jeton
                    // (verify_token Meta, secret Telegram/WhatsApp) dans le handler.
                    "/api/facebook/webhook/**",
                    "/api/telegram/webhook/**",
                    "/api/whatsapp/webhook/**",
                    // Appels entre services (planificateur de publication).
                    // Aucun jeton de session n'existe à 3h du matin : l'appel est
                    // authentifié par un secret partagé (X-Internal-Token) ET par la
                    // vérification que l'agent appartient à l'email déclaré, les deux
                    // faites dans le contrôleur. C'est le même schéma que les webhooks.
                    // Le service n'a pas de port exposé et l'api-gateway ne route pas
                    // /internal/** : le exposer serait une porte déverrouillée.
                    "/internal/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}

