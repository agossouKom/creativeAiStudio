package com.creativeai.auth.config;

import com.creativeai.auth.model.User;
import com.creativeai.auth.repository.UserRepository;
import com.creativeai.auth.security.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class SecurityConfig {

    private final UserRepository userRepository;
    private final JwtService jwtService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(AbstractHttpConfigurer::disable)
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login", "/register", "/register/verify", "/google", "/health", "/logout").permitAll()
                .requestMatchers("/check-email").permitAll()
                .requestMatchers("/auth/**", "/otp/**", "/error").permitAll()
                // /gmail/auth/url est retiré : il décide à quel compte les tokens
                // Gmail seront rattachés, donc il exige le JWT. Seul le callback
                // reste public (redirection navigateur de Google) — et son state
                // opaque à usage unique fait l'ancrage de sécurité.
                .requestMatchers("/gmail/callback").permitAll()
                .requestMatchers("/api/resultats/front", "/api/pubs/front", "/api/promotions/front", "/api/produits/front", "/api/social-links/active").permitAll()
                .requestMatchers("/v3/api-docs/**", "/auth/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Agent & credentials & user data routes — require authentication
                .requestMatchers("/api/agent/**", "/api/user/**", "/api/media/**").authenticated()
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public OncePerRequestFilter jwtAuthFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain chain) throws ServletException, IOException {
                try {
                    String token = null;

                    // 1. Try to get from Authorization header
                    String authHeader = request.getHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        token = authHeader.substring(7);
                    }

                    // 2. Try to get from Cookie if not in header
                    if (token == null && request.getCookies() != null) {
                        for (var cookie : request.getCookies()) {
                            if ("accessToken".equals(cookie.getName())) {
                                token = cookie.getValue();
                                break;
                            }
                        }
                    }

                    if (token != null) {
                        String email = jwtService.extractUsername(token);
                        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                            var userDetails = userDetailsService().loadUserByUsername(email);
                            if (jwtService.isValid(token, userDetails)) {
                                // Session revocation check
                                if (userDetails instanceof User user) {
                                    java.util.Date issuedAt = jwtService.extractIssuedAt(token);
                                    if (issuedAt != null && user.getRevocationTimestamp() != null 
                                            && issuedAt.getTime() < user.getRevocationTimestamp()) {
                                        log.warn("Attempt to use revoked token for user: {}", email);
                                        chain.doFilter(request, response);
                                        return;
                                    }
                                }

                                var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                                        userDetails, null, userDetails.getAuthorities());
                                SecurityContextHolder.getContext().setAuthentication(auth);
                                log.info("Authenticated user: {} with roles: {}", email, userDetails.getAuthorities());
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("JWT authentication error: {}", e.getMessage());
                }
                chain.doFilter(request, response);
            }
        };
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return email -> userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé: " + email));
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        var provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
