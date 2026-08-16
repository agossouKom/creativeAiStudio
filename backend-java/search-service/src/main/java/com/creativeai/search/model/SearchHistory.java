package com.creativeai.search.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "search_history")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SearchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String jobId;

    @Column(nullable = false)
    private String userEmail;

    @Enumerated(EnumType.STRING)
    private SearchType type;

    private String fileName;
    private String query;

    @Column(columnDefinition = "TEXT")
    private String resultJson;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SearchStatus status = SearchStatus.PENDING;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime completedAt;

    public enum SearchType  { AUDIO, VIDEO, PERSON }
    public enum SearchStatus { PENDING, PROCESSING, DONE, FAILED }
}
