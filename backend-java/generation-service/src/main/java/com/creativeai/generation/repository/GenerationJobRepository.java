package com.creativeai.generation.repository;

import com.creativeai.generation.model.GenerationJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GenerationJobRepository extends JpaRepository<GenerationJob, Long> {

    Optional<GenerationJob> findByJobIdAndUserEmail(String jobId, String userEmail);

    Optional<GenerationJob> findByJobId(String jobId);

    boolean existsByJobId(String jobId);

    Page<GenerationJob> findByUserEmailOrderByCreatedAtDesc(String userEmail, Pageable pageable);
}
