package com.creativeai.generation.repository;

import com.creativeai.generation.model.SocialPublishRequest;
import com.creativeai.generation.model.PublishStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SocialPublishRequestRepository extends JpaRepository<SocialPublishRequest, Long> {

    Optional<SocialPublishRequest> findByRequestIdAndUserEmail(String requestId, String userEmail);

    Optional<SocialPublishRequest> findByRequestId(String requestId);

    Page<SocialPublishRequest> findByUserEmailOrderByCreatedAtDesc(String userEmail, Pageable pageable);

    List<SocialPublishRequest> findByJobIdOrderByCreatedAtDesc(String jobId);

    List<SocialPublishRequest> findByStatus(PublishStatus status);
}
