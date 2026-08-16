package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "social_media_entreprises")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SocialMediaEntreprise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entreprise_id", nullable = false)
    private Entreprise entreprise;

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
