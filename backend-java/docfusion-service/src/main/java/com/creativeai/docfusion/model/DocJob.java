package com.creativeai.docfusion.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "doc_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String jobId;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false, length = 50)
    private String operation;

    @Column(nullable = false, length = 20)
    private String status;

    private String fileName;

    @Column(length = 2000)
    private String resultUrl;

    @Column(columnDefinition = "TEXT")
    private String resultText;

    @Column(length = 1000)
    private String errorMsg;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
}
