package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.CardDesign;
import com.creativeai.agentteam.repository.CardDesignRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CardDesignService {

    private final CardDesignRepository repo;

    public List<CardDesign> list(String userId, String category) {
        if (category != null && !category.isBlank()) {
            return repo.findByUserIdAndCategoryAndDeletedFalseOrderByCreatedAtDesc(userId, category);
        }
        return repo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public CardDesign save(CardDesign design) {
        return repo.save(design);
    }

    @Transactional
    public CardDesign update(String id, String userId, CardDesign body) {
        CardDesign existing = repo.findByIdAndUserIdAndDeletedFalse(id, userId)
            .orElseThrow(() -> new IllegalArgumentException("Création introuvable"));
        existing.setName(body.getName());
        existing.setTemplateId(body.getTemplateId());
        existing.setCategory(body.getCategory());
        existing.setCardData(body.getCardData());
        existing.setPersons(body.getPersons());
        existing.setEditorObjects(body.getEditorObjects());
        existing.setEditedHtml(body.getEditedHtml());
        existing.setCopies(body.getCopies());
        existing.setPdfFormat(body.getPdfFormat());
        return repo.save(existing);
    }

    @Transactional
    public void delete(String id, String userId) {
        repo.findByIdAndUserIdAndDeletedFalse(id, userId).ifPresent(d -> {
            d.setDeleted(true);
            repo.save(d);
        });
    }
}
