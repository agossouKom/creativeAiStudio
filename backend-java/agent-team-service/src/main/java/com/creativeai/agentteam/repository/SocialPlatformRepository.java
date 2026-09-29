package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.SocialPlatform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SocialPlatformRepository extends JpaRepository<SocialPlatform, String> {

    List<SocialPlatform> findAllByOrderBySortOrderAsc();

    List<SocialPlatform> findByIsActiveTrueOrderBySortOrderAsc();

    long countByIsActiveTrue();
}
