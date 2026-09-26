package com.creativeai.generation.repository;

import com.creativeai.generation.model.GenerationOutput;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GenerationOutputRepository extends JpaRepository<GenerationOutput, Long> {

    List<GenerationOutput> findByJobIdAndExecutionVersionOrderByOutputIndex(String jobId, Integer executionVersion);

    Optional<GenerationOutput> findByJobIdAndExecutionVersionAndOutputIndex(String jobId, Integer executionVersion, Integer outputIndex);

    void deleteByJobIdAndExecutionVersion(String jobId, Integer executionVersion);
}
