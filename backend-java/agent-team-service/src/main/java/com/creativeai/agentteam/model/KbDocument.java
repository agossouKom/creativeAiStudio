package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "kb_documents", indexes = {
    @Index(name = "idx_kb_doc_kb", columnList = "knowledge_base_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class KbDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "knowledge_base_id", nullable = false)
    private KnowledgeBase knowledgeBase;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(name = "file_url", length = 1000)
    private String fileUrl;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    /** IDs vecteurs dans pgvector/Qdrant */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vector_ids", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String vectorIds;

    @Column(name = "indexed_at")
    private LocalDateTime indexedAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String metadata;
}
