package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_base", indexes = {
    @Index(name = "idx_cb2_user",     columnList = "user_id"),
    @Index(name = "idx_cb2_category", columnList = "category, user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardBase extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "code", length = 32)
    private String code;

    @Column(name = "category", nullable = false, length = 32)
    private String category;

    @Column(name = "card_design_id", length = 36)
    private String cardDesignId;

    @Column(name = "entreprise_id", length = 36)
    private String entrepriseId;

    @Column(name = "couleur1", length = 16)
    @Builder.Default
    private String couleur1 = "#1565c0";

    @Column(name = "couleur2", length = 16)
    @Builder.Default
    private String couleur2 = "#ffd600";
}
