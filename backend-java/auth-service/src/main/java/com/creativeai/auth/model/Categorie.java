package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Product category.
 * Supports soft-delete and active filtering via BaseEntity.deleted + active flag.
 */
@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Categorie extends BaseEntity {

    @Column(nullable = false, unique = true, length = 150)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
