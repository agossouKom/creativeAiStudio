package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "card_productions", indexes = {
    @Index(name = "idx_card_prod_user",       columnList = "user_id"),
    @Index(name = "idx_card_prod_design",      columnList = "design_id"),
    @Index(name = "idx_card_prod_entreprise",  columnList = "entreprise, user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardProduction extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "design_id", length = 36)
    private String designId;

    @Column(name = "design_name", nullable = false, length = 255)
    private String designName;

    @Column(name = "template_id", length = 32)
    private String templateId;

    @Column(name = "category", length = 64)
    private String category;

    @Column(name = "entreprise", length = 255)
    private String entreprise;

    @Column(name = "person_count", nullable = false)
    @Builder.Default
    private int personCount = 0;

    @Column(name = "copies", nullable = false)
    @Builder.Default
    private int copies = 1;

    /** JSON array of person IDs included in this production. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "person_ids", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String personIds = "[]";

    /** JSON array of person display names (prenoms + nom). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "person_names", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String personNames = "[]";
}
