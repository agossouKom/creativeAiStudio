package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "card_designs", indexes = {
    @Index(name = "idx_card_design_user", columnList = "user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardDesign extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "template_id", nullable = false, length = 32)
    private String templateId;

    @Column(name = "category", nullable = false, length = 64)
    private String category;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "card_data", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String cardData = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String persons = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "editor_objects", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String editorObjects = "[]";

    @Column(name = "edited_html", columnDefinition = "text")
    @Builder.Default
    private String editedHtml = "";

    @Column(name = "copies", nullable = false)
    @Builder.Default
    private int copies = 1;

    @Column(name = "pdf_format", nullable = false, length = 32)
    @Builder.Default
    private String pdfFormat = "portrait";

    @Column(name = "company", length = 255)
    private String company;
}
