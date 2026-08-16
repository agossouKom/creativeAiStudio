package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Contact form submission from a visitor or user.
 */
@Entity
@Table(name = "contacts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Contact extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String nomComplet;

    @Column(nullable = false, length = 150)
    private String email;

    @Column(nullable = false, length = 250)
    private String sujet;

    @Column(nullable = false, length = 3000)
    private String message;

    /** Whether the team has handled this contact request */
    @Builder.Default
    @Column(nullable = false)
    private boolean traite = false;
}
