package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Assignation automatique d'un provider LLM à un compte.
 *
 * <p>Un administrateur marque un de ses providers comme <b>provider par défaut
 * de la plateforme</b> ({@link LlmProvider#isPlatformDefault()}). Dès qu'un
 * compte ne possède encore aucun provider — cas d'un compte fraîchement créé,
 * mais aussi d'un compte antérieur à la mise en place du provider par défaut —
 * le modèle de cette plateforme est recopié dans le compte, en scope
 * {@code user_id}.
 *
 * <p>Pourquoi une copie plutôt qu'un simple héritage à la résolution :
 * l'utilisateur voit alors dans son espace de travail un provider qu'il peut
 * supprimer, renommer, passer en primaire ou remplacer par le sien. S'il ne
 * configurait rien, l'héritage de la résolution suffirait, mais il ne pourrait
 * ni voir ni modifier ce qu'il utilise.
 *
 * <p>La copie reprend la clé chiffrée telle quelle : elle l'est avec la clé
 * maîtresse du service ({@code agent.encryption-key}), identique pour tous les
 * providers, donc déchiffrable de la même façon. La clé n'est jamais
 * journalisée.
 *
 * <p>L'opération est idempotente : elle ne fait rien si le compte a déjà au
 * moins un provider actif, et ne s'exécute pas si aucun provider par défaut
 * n'est configuré.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LlmProviderProvisioningService {

    private final LlmProviderRepository llmRepo;

    /** Compte administrateur utilisé comme repli si aucun provider n'est marqué par défaut. */
    @org.springframework.beans.factory.annotation.Value("${agent.admin-user-id:}")
    private String adminUserId;

    /**
     * Recopie le provider par défaut de la plateforme dans le compte si celui-ci
     * n'a aucun provider.
     *
     * <p>{@code REQUIRES_NEW} est indispensable, et non décoratif. L'appelant
     * est très souvent une méthode {@code @Transactional(readOnly = true)} — la
     * lecture du provider résolu, par exemple. Spring passe alors Hibernate en
     * {@code FlushMode.MANUAL} pour cette transaction : le {@code save()} est
     * exécuté en mémoire, l'identifiant est attribué, la méthode journalise sa
     * réussite et rend la bonne réponse — mais l'INSERT n'est jamais flushé.
     * Symptôme : la réponse est correcte, la ligne n'existe pas en base, et
     * l'appel suivant reprovisionne à l'identique. Suspendre la transaction
     * parente et écrire dans la sienne évite ce piège ; l'idempotence garantit
     * qu'un double appel ne crée pas de doublon.
     *
     * @return le provider créé, ou {@link Optional#empty()} si rien n'a été fait
     *         (le compte a déjà un provider, ou aucun provider par défaut n'est défini)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<LlmProvider> ensureDefaultProviderFor(String userId) {
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }

        // Le compte a déjà son propre modèle : on ne touche à rien.
        List<LlmProvider> existing = llmRepo
            .findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(userId);
        if (!existing.isEmpty()) {
            return Optional.empty();
        }

        Optional<LlmProvider> platformDefault =
            llmRepo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse();
        if (platformDefault.isEmpty()) {
            return Optional.empty();
        }

        LlmProvider source = platformDefault.get();
        LlmProvider copy = LlmProvider.builder()
            .userId(userId)
            .type(source.getType())
            .modelId(source.getModelId())
            .baseUrl(source.getBaseUrl())
            .encryptedApiKey(source.getEncryptedApiKey())
            .displayName(source.getDisplayName())
            .temperature(source.getTemperature())
            .maxTokens(source.getMaxTokens())
            .topP(source.getTopP())
            .streamingEnabled(source.isStreamingEnabled())
            .requestTimeoutSeconds(source.getRequestTimeoutSeconds())
            .rateLimitRpm(source.getRateLimitRpm())
            .extraParams(source.getExtraParams())
            .primary(true)
            .active(true)
            .platformDefault(false)
            .build();

        LlmProvider saved = llmRepo.save(copy);
        log.info("[LLM] Provider par défaut provisionné pour userId={} depuis le provider plateforme id={}",
            userId, source.getId());
        return Optional.of(saved);
    }

    /**
     * Définit (ou remplace) le provider par défaut de la plateforme.
     *
     * <p>Chaque appel retire le drapeau des autres providers : l'index unique
     * partiel en base interdit d'en avoir deux, il faut donc le désactiver en
     * amont plutôt que de laisser l'insertion échouer.
     *
     * @return le provider désormais marqué par défaut
     */
    @Transactional
    public LlmProvider setPlatformDefault(LlmProvider provider) {
        llmRepo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse()
            .filter(previous -> !previous.getId().equals(provider.getId()))
            .ifPresent(previous -> {
                previous.setPlatformDefault(false);
                llmRepo.save(previous);
                log.info("[LLM] Provider id={} n'est plus le provider par défaut de la plateforme",
                    previous.getId());
            });

        provider.setPlatformDefault(true);
        return llmRepo.save(provider);
    }

    /** Retire le statut de provider par défaut sans supprimer le provider. */
    @Transactional
    public void clearPlatformDefault() {
        llmRepo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse()
            .ifPresent(previous -> {
                previous.setPlatformDefault(false);
                llmRepo.save(previous);
                log.info("[LLM] Plus aucun provider par défaut de la plateforme");
            });
    }

    /** Provider par défaut de la plateforme, s'il en existe un. */
    @Transactional(readOnly = true)
    public Optional<LlmProvider> currentPlatformDefault() {
        return llmRepo.findByPlatformDefaultTrueAndActiveTrueAndDeletedFalse();
    }

    /**
     * Provider dont hérite un compte qui n'a rien configuré lui-même.
     *
     * <p>Ordre : provider marqué par défaut de la plateforme, puis à défaut le
     * provider primaire du compte administrateur ({@code agent.admin-user-id}).
     * Cette seconde branche préserve le comportement des installations qui
     * n'ont pas encore utilisé le nouveau mécanisme.
     *
     * @param userId compte concerné ; exclu du repli admin pour ne pas se
     *              renvoyer le provider d'un compte comme réponse de lui-même
     */
    @Transactional(readOnly = true)
    public Optional<LlmProvider> resolveInheritedDefault(String userId) {
        Optional<LlmProvider> platformDefault = currentPlatformDefault();
        if (platformDefault.isPresent()) {
            return platformDefault;
        }
        if (adminUserId == null || adminUserId.isBlank() || adminUserId.equals(userId)) {
            return Optional.empty();
        }
        return llmRepo.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc(adminUserId)
            .stream().findFirst();
    }
}