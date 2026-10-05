package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LlmProviderRepository extends JpaRepository<LlmProvider, String> {
    List<LlmProvider>     findByAgentIdAndDeletedFalseOrderByPrimaryDesc(String agentId);
    List<LlmProvider>     findByAgentIdAndPrimaryTrueAndDeletedFalse(String agentId);
    Optional<LlmProvider> findByAgentIdAndTypeAndDeletedFalse(String agentId, LlmType type);
    List<LlmProvider>     findByAgentIdOrderByPrimaryDescCreatedAtDesc(String agentId);
    void deleteByAgentId(String agentId);

    List<LlmProvider>     findByUserIdAndDeletedFalseOrderByPrimaryDesc(String userId);
    List<LlmProvider>     findByUserIdAndPrimaryTrueAndDeletedFalse(String userId);
    List<LlmProvider>     findByUserIdOrderByPrimaryDescCreatedAtDesc(String userId);
    List<LlmProvider>     findByUserIdAndIdAndDeletedFalse(String userId, String id);
    List<LlmProvider>     findByUserIdAndIdAndDeletedTrue(String userId, String id);

    List<LlmProvider>     findByTeamIdAndDeletedFalseOrderByPrimaryDesc(String teamId);
    List<LlmProvider>     findByTeamIdOrderByPrimaryDescCreatedAtDesc(String teamId);
    List<LlmProvider>     findByTeamIdAndIdAndDeletedFalse(String teamId, String id);
    List<LlmProvider>     findByTeamIdAndIdAndDeletedTrue(String teamId, String id);

    // ── Résolution effective (LlmGateway) ──────────────────────────────────────
    // Variantes « ActiveTrue » : un provider désactivé (active=false) reste
    // visible et réactivable via le CRUD, mais ne doit plus être proposé au
    // runtime. Les méthodes ci-dessus sont volontairement conservées telles
    // quelles pour le listing.
    List<LlmProvider> findByAgentIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(String agentId);
    List<LlmProvider> findByTeamIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(String teamId);
    List<LlmProvider> findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(String userId);

    /**
     * Provider par défaut de la plateforme, défini par un administrateur.
     * Un seul peut être actif à la fois (index unique partiel). Utilisé comme
     * source de recopie lors de l'inscription d'un utilisateur.
     */
    Optional<LlmProvider> findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse();
}
