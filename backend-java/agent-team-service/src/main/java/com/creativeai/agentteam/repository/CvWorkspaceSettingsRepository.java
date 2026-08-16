package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CvWorkspaceSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CvWorkspaceSettingsRepository extends JpaRepository<CvWorkspaceSettings, String> {

    Optional<CvWorkspaceSettings> findByUserId(String userId);
}
