package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * Advertising client who orders Pub campaigns.
 */
@Entity
@Table(name = "client_pubs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ClientPub extends BaseEntity {

    @Column(length = 100)
    private String nom;

    @Column(length = 100)
    private String prenom;

    @Column(length = 200)
    private String raisonSociale;

    @Column(length = 30)
    private String contact1;

    @Column(length = 30)
    private String contact2;

    @Column(unique = true, length = 150)
    private String email;

    @Column(length = 150)
    private String responsable;

    @Column(length = 250)
    private String siteWeb;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @OneToMany(mappedBy = "clientPub", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SocialMediaClient> reseauxSociaux = new ArrayList<>();
}
