package com.creativeai.docfusion.repository;

import com.creativeai.docfusion.model.DocJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocJobRepository extends JpaRepository<DocJob, Long> {
    Optional<DocJob> findByJobId(String jobId);
    List<DocJob> findByUserEmailOrderByCreatedAtDesc(String userEmail);
}
