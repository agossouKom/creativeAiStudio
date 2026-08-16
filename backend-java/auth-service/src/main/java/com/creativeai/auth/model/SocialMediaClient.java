package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Social media link attached to a ClientPub (advertiser).
 */
@Entity
@Table(name = "social_media_clients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SocialMediaClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_pub_id", nullable = false)
    private ClientPub clientPub;

    @Column(nullable = false, length = 100)
    private String plateforme;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(length = 100)
    private String iconClass;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
