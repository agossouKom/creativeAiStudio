package com.creativeai.telegram.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

/**
 * Sécurité du service telegram-mcp.
 *
 * <p>Le fichier était vide (« intentionnellement vide »), donc le service
 * n'avait aucune chaîne de filtres : pas de Spring Security du tout. Tout ce
 * que le serveur expose était accessible sans authentification, y compris les
 * endpoints MCP du starter Spring AI, qui permettent de piloter le LLM et
 * d'envoyer des messages Telegram.
 *
 * <p>Ces endpoints sont sur un port loopback en dev, mais restent joignables
 * depuis tout conteneur du réseau Docker, et le port est publié par le compose.
 *
 * <p>Politique retenue :
 * <ul>
 *   <li>{@code /telegram/webhook} public — Telegram n'a pas de JWT ; c'est le
 *       contrôleur qui exige le {@code X-Telegram-Bot-Api-Secret-Token}
 *       (fail-closed si non configuré) ;</li>
 *   <li>{@code /actuator/health} public — utilisé par healthcheck.sh ;</li>
 *   <li>tout le reste refusé. Aucun consommateur connu dans le dépôt n'appelle
 *       les endpoints MCP ; s'il en faut un, il faudra lui ajouter une
 *       authentification explicite.</li>
 * </ul>
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain telegramMcpFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())   // API sans cookie de session
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/telegram/webhook").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                .anyRequest().denyAll()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }
}
