package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.CardProduction;
import com.creativeai.agentteam.repository.CardProductionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CardProductionService {

    private final CardProductionRepository repo;

    public List<CardProduction> listByUser(String userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<CardProduction> listByUserAndEntreprise(String userId, String entreprise) {
        return repo.findByUserIdAndEntreprise(userId, entreprise);
    }

    public CardProduction save(CardProduction prod) {
        return repo.save(prod);
    }

    public void delete(String id, String userId) {
        repo.findById(id).ifPresent(p -> {
            if (p.getUserId().equals(userId)) {
                p.setDeleted(true);
                repo.save(p);
            }
        });
    }
}
