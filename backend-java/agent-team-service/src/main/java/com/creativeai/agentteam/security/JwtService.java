package com.creativeai.agentteam.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Service
public class JwtService {

    @Value("${agent.jwt-secret}")
    private String jwtSecret;

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String extractUserId(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Rôle porté par le jeton. auth-service l'écrit à la signature
     * (`claims.put("role", user.getRole().name())`), mais ce service l'ignorait
     * et attribuait ROLE_USER à tout le monde : aucun endpoint administrateur
     * n'était donc possible ici, et un `@PreAuthorize("hasRole('ADMIN')")`
     * aurait été ignoré silencieusement.
     *
     * Un jeton sans claim `role` reste ROLE_USER : c'est le cas le restrictif.
     */
    public String extractRole(String token) {
        try {
            String role = extractClaims(token).get("role", String.class);
            return (role == null || role.isBlank()) ? "USER" : role;
        } catch (Exception e) {
            log.debug("Role absent du JWT: {}", e.getMessage());
            return "USER";
        }
    }

    public boolean isValid(String token) {
        try {
            Claims c = extractClaims(token);
            return c.getExpiration().after(new Date());
        } catch (Exception e) {
            log.debug("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    private Claims extractClaims(String token) {
        return Jwts.parser().verifyWith(getKey()).build()
            .parseSignedClaims(token).getPayload();
    }
}
