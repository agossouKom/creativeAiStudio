package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Sales order. A Vente groups LigneVente items.
 * - client: the User who purchased
 * - total: sum before any discount
 * - montant: actual amount paid
 * - quantite: total number of items across all lines
 */
@Entity
@Table(name = "ventes", indexes = {
        @Index(name = "idx_vente_client", columnList = "client_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Vente extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private User client;

    @OneToMany(mappedBy = "vente", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LigneVente> lignes = new ArrayList<>();

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal total = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal montant = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantite = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private com.creativeai.auth.model.enums.PaymentMode paymentMode = com.creativeai.auth.model.enums.PaymentMode.CREDIT_CARD;
}
