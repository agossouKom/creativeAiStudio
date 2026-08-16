package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.CvAnalysis;
import com.creativeai.agentteam.model.CvWorkspaceSettings;
import com.creativeai.agentteam.repository.CvAnalysisRepository;
import com.creativeai.agentteam.repository.CvWorkspaceSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CvWorkspaceService {

    private final CvAnalysisRepository analysisRepo;
    private final CvWorkspaceSettingsRepository settingsRepo;

    public List<CvAnalysis> list(String userId) {
        return analysisRepo.findByUserId(userId);
    }

    @Transactional
    public CvAnalysis save(CvAnalysis analysis) {
        return analysisRepo.save(analysis);
    }

    @Transactional
    public CvAnalysis updateStatus(String id, String userId, String status) {
        CvAnalysis cv = analysisRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new IllegalArgumentException("CV non trouvé"));
        cv.setStatus(status);
        return analysisRepo.save(cv);
    }

    @Transactional
    public CvAnalysis updateNotes(String id, String userId, String notes) {
        CvAnalysis cv = analysisRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new IllegalArgumentException("CV non trouvé"));
        cv.setNotes(notes);
        return analysisRepo.save(cv);
    }

    @Transactional
    public void delete(String id, String userId) {
        analysisRepo.findByIdAndUserId(id, userId).ifPresent(cv -> {
            cv.setDeleted(true);
            analysisRepo.save(cv);
        });
    }

    @Transactional
    public void clearAll(String userId) {
        analysisRepo.softDeleteAllByUserId(userId);
    }

    public Map<String, String> getSettings(String userId) {
        String mode = settingsRepo.findByUserId(userId)
            .map(CvWorkspaceSettings::getMode)
            .orElse(null);
        return Map.of("mode", mode != null ? mode : "");
    }

    @Transactional
    public void saveSettings(String userId, String mode) {
        CvWorkspaceSettings settings = settingsRepo.findByUserId(userId)
            .orElseGet(() -> CvWorkspaceSettings.builder().userId(userId).build());
        settings.setMode(mode);
        settingsRepo.save(settings);
    }
}
