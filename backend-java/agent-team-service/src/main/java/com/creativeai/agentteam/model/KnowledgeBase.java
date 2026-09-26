package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "knowledge_bases", indexes = {
    @Index(name = "idx_kb_agent", columnList = "agent_id", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class KnowledgeBase extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false, unique = true)
    @JsonIgnore
    private Agent agent;

    @Column(nullable = false, length = 200)
    private String name;

    @Builder.Default
    @Column(name = "embedding_model", length = 100)
    private String embeddingModel = "nomic-embed-text";

    @Builder.Default
    @Column(name = "chunk_size", nullable = false)
    private int chunkSize = 512;

    @Builder.Default
    @Column(name = "chunk_overlap", nullable = false)
    private int chunkOverlap = 50;

    @Builder.Default
    @Column(name = "top_k", nullable = false)
    private int topK = 5;

    @Builder.Default
    @Column(name = "similarity_threshold", nullable = false)
    private double similarityThreshold = 0.7;

    @Builder.Default
    @Column(name = "document_count", nullable = false)
    private int documentCount = 0;

    @OneToMany(mappedBy = "knowledgeBase", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<KbDocument> documents = new ArrayList<>();
}
