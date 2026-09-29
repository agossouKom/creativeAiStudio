package com.creativeai.agentteam.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Le rôle doit venir du jeton, pas d'une valeur fixe.
 *
 * Régression sur un défaut bloquant pour l'administration : `JwtAuthFilter`
 * attribuait `ROLE_USER` à tout appelant, en dur. Conséquences : aucun
 * endpoint admin n'était possible sur ce service, et comme `@PreAuthorize`
 * était ignoré faute de `@EnableMethodSecurity`, ajouter une protection par
 * rôle aurait donné une fausse impression de sécurité.
 */
class JwtAuthFilterRoleTest {

    private static final String SECRET = "un-secret-de-test-suffisamment-long-pour-hmac-sha256";

    private JwtService jwtService;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() throws Exception {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "jwtSecret", SECRET);
        filter = new JwtAuthFilter(jwtService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        // Le contexte est un ThreadLocal partagé par toutes les classes du même JVM
        // Surefire. Sans ce nettoyage, l'authentification du dernier test survit et
        // fait passer `authenticated()` dans les tests de la chaîne de sécurité
        // exécutés ensuite (upload answered 503 au lieu de 403).
        SecurityContextHolder.clearContext();
    }

    private String tokenWith(Map<String, Object> claims) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        var builder = Jwts.builder().subject("user@example.com")
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + 60_000));
        claims.forEach(builder::claim);
        return builder.signWith(key).compact();
    }

    private void filter(String token) throws Exception {
        var request = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/agents");
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> { });
    }

    private String grantedRole() throws Exception {
        var auth = (UsernamePasswordAuthenticationToken) SecurityContextHolder.getContext()
            .getAuthentication();
        return auth.getAuthorities().stream()
            .map(a -> a.getAuthority())
            .findFirst().orElse(null);
    }

    @Test
    void unRoleAdminDonneRoleAdmin() throws Exception {
        filter(tokenWith(Map.of("role", "ADMIN")));

        assertEquals("ROLE_ADMIN", grantedRole());
    }

    @Test
    void unRoleUserDonneRoleUser() throws Exception {
        filter(tokenWith(Map.of("role", "USER")));

        assertEquals("ROLE_USER", grantedRole());
    }

    /**
     * Cas restrictif : un jeton sans claim de rôle ne doit surtout pas être
     * interprété comme administrateur.
     */
    @Test
    void unJetonSansRoleDonneRoleUser() throws Exception {
        filter(tokenWith(Map.of()));

        assertEquals("ROLE_USER", grantedRole());
    }

    @Test
    void unJetonExpireNauthentifiePersonne() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String expired = Jwts.builder().subject("user@example.com")
            .claim("role", "ADMIN")
            .expiration(new Date(System.currentTimeMillis() - 1000))
            .signWith(key).compact();

        filter(expired);

        assertTrue(SecurityContextHolder.getContext().getAuthentication() == null,
            "un jeton expiré ne doit jamais produire une authentification");
    }

    @Test
    void leRoleVientDuJetonEtPasDuSujet() throws Exception {
        // Le subject est l'email : le rôle ne doit pas être déduit de lui.
        filter(tokenWith(Map.of("role", "ADMIN")));

        var auth = (UsernamePasswordAuthenticationToken) SecurityContextHolder.getContext()
            .getAuthentication();
        assertEquals("user@example.com", auth.getPrincipal());
        assertTrue(auth.getAuthorities().stream()
            .noneMatch(a -> "user@example.com".equals(a.getAuthority())));
    }
}
