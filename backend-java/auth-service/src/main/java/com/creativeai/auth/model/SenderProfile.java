package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "sender_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class SenderProfile extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(length = 100) private String prenom;
    @Column(length = 100) private String nom;
    @Column(length = 150) private String poste;
    @Column(length = 150) private String departement;
    @Column(length = 200) private String societe;
    @Column(length = 150) private String secteur;
    @Column(length = 500) private String siteWeb;
    @Column(length = 500) private String adresse;
    @Column(length = 150) private String email;
    @Column(length = 50)  private String telephone;
    @Column(length = 50)  private String telephoneFixe;
    @Column(length = 300) private String linkedin;
    @Column(columnDefinition = "TEXT") private String signature;
    @Column(length = 50)  private String tonEmail;
    @Column(length = 10)  private String langue;
    @Column(length = 10)  private String devise;
    @Column(columnDefinition = "TEXT") private String contexteSup;
}
