package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Stores Google OAuth2 tokens for Gmail access, one record per user.
 * Tokens are refreshed automatically when expired.
 */
@Entity
@Table(name = "gmail_tokens", indexes = {
    @Index(name = "idx_gmail_token_user", columnList = "user_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class GmailToken extends BaseEntity {

    @Column(name = "user_id", nullable = false, unique = true, length = 50)
    private String userId;

    /** Gmail email address linked (e.g. damien@gmail.com) */
    @Column(name = "gmail_email", length = 200)
    private String gmailEmail;

    /** Google access token — expires in 1 hour */
    @Column(name = "access_token", length = 2048, nullable = false)
    private String accessToken;

    /** Google refresh token — permanent (until revoked) */
    @Column(name = "refresh_token", length = 2048)
    private String refreshToken;

    /** When the access token expires */
    @Column(name = "access_token_expiry")
    private LocalDateTime accessTokenExpiry;

    /** When the user granted access */
    @Column(name = "connected_at")
    private LocalDateTime connectedAt;

    public boolean isAccessTokenExpired() {
        return accessTokenExpiry == null || accessTokenExpiry.isBefore(LocalDateTime.now().plusMinutes(2));
    }
}
