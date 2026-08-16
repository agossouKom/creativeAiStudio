package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SubscriptionUsage;
import com.creativeai.agentteam.model.UserSubscription;
import com.creativeai.agentteam.model.enums.SubscriptionPlan;
import com.creativeai.agentteam.repository.SubscriptionUsageRepository;
import com.creativeai.agentteam.repository.UserSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Gestion des quotas d'abonnement.
 *
 * Flux typique :
 *   1. {@code checkTaskQuota(userId)} — lève {@link QuotaExceededException} si dépassé
 *   2. Exécuter la tâche
 *   3. {@code incrementTaskUsage(userId)} — incrément asynchrone (non bloquant)
 *
 * Les abonnements sont créés automatiquement en FREE à la première utilisation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaService {

    private static final DateTimeFormatter PERIOD_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final UserSubscriptionRepository  subscriptionRepo;
    private final SubscriptionUsageRepository usageRepo;

    // ── Vérification ──────────────────────────────────────────────────────────

    /**
     * Vérifie que l'utilisateur n'a pas épuisé son quota mensuel de tâches.
     *
     * @throws QuotaExceededException si la limite est atteinte
     */
    @Transactional(readOnly = true)
    public void checkTaskQuota(String userId) {
        UserSubscription sub = getOrCreateSubscription(userId);
        if (sub.isExpired()) {
            // Abonnement expiré → retour au plan FREE
            sub = downgradeToFree(sub);
        }

        String period   = currentPeriod();
        int tasksUsed   = usageRepo.findByUserIdAndPeriod(userId, period)
            .map(SubscriptionUsage::getTasksUsed).orElse(0);

        if (tasksUsed >= sub.getTasksPerMonth()) {
            log.warn("[QUOTA] Utilisateur {} a atteint la limite ({}/{} tâches, plan {})",
                userId, tasksUsed, sub.getTasksPerMonth(), sub.getPlan());
            throw new QuotaExceededException(tasksUsed, sub.getTasksPerMonth(), sub.getPlan().name());
        }
    }

    /**
     * Incrémente le compteur de tâches pour le mois courant.
     * Méthode @Async — ne bloque pas le thread de création de tâche.
     */
    @Async
    @Transactional
    public void incrementTaskUsage(String userId) {
        try {
            usageRepo.incrementTaskUsage(userId, currentPeriod());
        } catch (Exception e) {
            log.warn("[QUOTA] Impossible d'incrémenter le compteur pour userId={}: {}", userId, e.getMessage());
        }
    }

    // ── Lecture ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UserSubscription getSubscription(String userId) {
        return getOrCreateSubscription(userId);
    }

    @Transactional(readOnly = true)
    public int getCurrentMonthUsage(String userId) {
        return usageRepo.findByUserIdAndPeriod(userId, currentPeriod())
            .map(SubscriptionUsage::getTasksUsed).orElse(0);
    }

    // ── Gestion des abonnements ───────────────────────────────────────────────

    @Transactional
    public UserSubscription upgrade(String userId, SubscriptionPlan newPlan) {
        UserSubscription sub = getOrCreateSubscription(userId);
        sub.setPlan(newPlan);
        sub.setTasksPerMonth(newPlan.getDefaultTasksPerMonth());
        sub.setMaxAgents(newPlan.getDefaultMaxAgents());
        sub.setMaxTeams(newPlan.getDefaultMaxTeams());
        sub.setPremiumLlmEnabled(newPlan.isPremiumLlmEnabled());
        sub.setValidUntil(null);
        log.info("[QUOTA] Utilisateur {} passé au plan {}", userId, newPlan);
        return subscriptionRepo.save(sub);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    @Transactional
    public UserSubscription getOrCreateSubscription(String userId) {
        return subscriptionRepo.findByUserId(userId)
            .orElseGet(() -> {
                SubscriptionPlan plan = SubscriptionPlan.FREE;
                UserSubscription sub = UserSubscription.builder()
                    .userId(userId)
                    .plan(plan)
                    .tasksPerMonth(plan.getDefaultTasksPerMonth())
                    .maxAgents(plan.getDefaultMaxAgents())
                    .maxTeams(plan.getDefaultMaxTeams())
                    .premiumLlmEnabled(plan.isPremiumLlmEnabled())
                    .build();
                log.info("[QUOTA] Création abonnement FREE pour userId={}", userId);
                return subscriptionRepo.save(sub);
            });
    }

    private UserSubscription downgradeToFree(UserSubscription sub) {
        SubscriptionPlan free = SubscriptionPlan.FREE;
        sub.setPlan(free);
        sub.setTasksPerMonth(free.getDefaultTasksPerMonth());
        sub.setMaxAgents(free.getDefaultMaxAgents());
        sub.setMaxTeams(free.getDefaultMaxTeams());
        sub.setPremiumLlmEnabled(false);
        sub.setValidUntil(null);
        return subscriptionRepo.save(sub);
    }

    private static String currentPeriod() {
        return LocalDate.now().format(PERIOD_FMT);
    }
}
