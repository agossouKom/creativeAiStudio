package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Records a user's search history and whether it returned results.
 */
@Entity
@Table(name = "historique_recherches", indexes = {
        @Index(name = "idx_hist_client", columnList = "client_id"),
        @Index(name = "idx_hist_resultat", columnList = "resultat_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class HistoriqueRecherche extends BaseEntity {

    /** The user who performed the search */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private User client;

    /** The matched result (nullable if not found) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resultat_id")
    private ResultatRecherche resultat;

    @Column(nullable = false, length = 500)
    private String requete; // the search query text

    /** true if a result was found, false otherwise */
    @Builder.Default
    @Column(nullable = false)
    private boolean found = false;
}
