package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Entity to manage user sessions and JWT tokens (Whitelisting/Revocation)
 */
@Entity
@Table(name = "user_sessions", indexes = {
        @Index(name = "idx_session_user", columnList = "user_id"),
        @Index(name = "idx_session_access_token", columnList = "access_token"),
        @Index(name = "idx_session_refresh_token", columnList = "refresh_token")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class UserSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "access_token", length = 1000, nullable = false)
    private String accessToken;

    @Column(name = "refresh_token", length = 1000)
    private String refreshToken;

    @Column(name = "access_token_expires_at", nullable = false)
    private LocalDateTime accessTokenExpiresAt;

    @Column(name = "refresh_token_expires_at")
    private LocalDateTime refreshTokenExpiresAt;

    @Builder.Default
    private boolean revoked = false;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "device_type", length = 50)
    private String deviceType; // e.g., "Mobile", "Desktop", "Tablet"

    @Column(name = "last_accessed_at")
    private LocalDateTime lastAccessedAt;

    @Column(name = "logout_at")
    private LocalDateTime logoutAt;

    /**
     * Check if the session is still valid
     */
    public boolean isValid() {
        return !revoked && accessTokenExpiresAt != null && accessTokenExpiresAt.isAfter(LocalDateTime.now());
    }

    /**
     * Revoke the session
     */
    public void revoke() {
        this.revoked = true;
        this.logoutAt = LocalDateTime.now();
    }
}
