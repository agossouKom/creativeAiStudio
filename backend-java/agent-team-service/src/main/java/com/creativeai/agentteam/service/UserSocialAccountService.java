package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.model.UserSocialAccount;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import com.creativeai.agentteam.repository.UserSocialAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Écriture des comptes unifiés (`user_social_accounts`) au retour de l'OAuth.
 *
 * <p>Pourquoi une table alors que `channels` porte déjà des tokens ? Parce que
 * `channels` répond à « quel canal cet agent publie-t-il ? » — un agent, un
 * canal, une Page. Le compte social, lui, appartient à un *utilisateur* et peut
 * être partagé entre plusieurs agents. On continue d'écrire les deux : le canal
 * garde ses `encrypted_credentials` (rien de existant ne bouge, la publication
 * fonctionne exactement comme avant) et le compte unifié devient la source
 * de référence pour l'expiration et le rafraîchissement.
 *
 * <p>Si la plateforme n'existe pas en base ou est désactivée, on renvoie
 * {@code null} sans échouer : la connexion doit rester possible même si
 * l'administrateur n'a pas encore terminé la configuration. C'est
 * {@code SocialPlatformConfigService} qui refuse de lancer un OAuth non
 * configuré, pas cette méthode.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserSocialAccountService {

    private final UserSocialAccountRepository accountRepository;
    private final SocialPlatformRepository platformRepository;
    private final EncryptionService encryptionService;
    private final SocialPlatformConfigService configService;
    private final ObjectMapper objectMapper;

    /**
     * Crée ou met à jour le compte de l'utilisateur à partir du résultat de
     * l'échange OAuth.
     *
     * @param credentialsJson JSON déjà produit par le contrôleur OAuth ; le même
     *        contenu est chiffré et rangé dans {@code access_token_enc} pour
     *        que le service d'envoi puisse s'en servir sans nouvelle requête.
     * @return le compte persisté, ou {@code null} si la plateforme est inconnue
     *         ou désactivée côté configuration.
     */
    @Transactional
    public UserSocialAccount recordFromOauth(String userId, String platformId,
                                             String platformAccountId,
                                             String platformAccountName,
                                             String credentialsJson,
                                             List<String> scopes) {

        if (userId == null || userId.isBlank()
            || platformAccountId == null || platformAccountId.isBlank()) {
            // Sans identifiant de compte réseau, la ligne serait inexploitable
            // (impossible de retrouver le compte) : on ne crée rien.
            log.warn("[USER_SOCIAL] Compte OAuth sans identifiant réseau, ignoré ({} {})",
                platformId, userId);
            return null;
        }

        String resolvedPlatformId = configService.resolvePlatformId(platformId);
        Optional<SocialPlatform> found = platformRepository.findById(resolvedPlatformId);
        if (found.isEmpty()) {
            log.warn("[USER_SOCIAL] Plateforme {} inconnue en base, compte non enregistré", resolvedPlatformId);
            return null;
        }
        SocialPlatform platform = found.get();
        if (!Boolean.TRUE.equals(platform.getIsActive())) {
            log.warn("[USER_SOCIAL] Plateforme {} désactivée, compte non enregistré", resolvedPlatformId);
            return null;
        }

        UserSocialAccount account = accountRepository
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse(
                userId, platform.getId(), platformAccountId)
            .orElseGet(() -> {
                UserSocialAccount created = new UserSocialAccount();
                created.setUserId(userId);
                created.setPlatform(platform);
                created.setPlatformAccountId(platformAccountId);
                created.setConnectedAt(LocalDateTime.now());
                return created;
            });

        boolean nouveau = account.getId() == null;
        account.setPlatformAccountName(
            platformAccountName == null || platformAccountName.isBlank()
                ? account.getPlatformAccountName() : platformAccountName);
        account.setStatus("CONNECTED");
        account.setLastError(null);
        account.setLastRefreshedAt(LocalDateTime.now());

        try {
            account.setAccessTokenEnc(encryptionService.encrypt(credentialsJson));
        } catch (RuntimeException e) {
            // Sans jeton le compte est inutilisable, mais l'échec ne doit pas
            // faire perdre la connexion au canal : on le trace et on continue.
            log.error("[USER_SOCIAL] Chiffrement impossible pour {} / {}",
                userId, platformAccountId, e);
            account.setStatus("ERROR");
            account.setLastError("Chiffrement du jeton impossible");
        }

        // Alimentation des colonnes de pilotage du refresh depuis le JSON des
        // credentials, sans changer la signature : le contrôleur ajoute déjà
        // `expiresIn`, `refreshToken` et `fbUserId` aux plateformes concernées.
        populateTokenMetadata(account, credentialsJson);

        if (scopes != null && !scopes.isEmpty()) {
            account.setScopesGranted(toJson(scopes));
        }

        UserSocialAccount saved = accountRepository.save(account);
        log.info("[USER_SOCIAL] Compte {} {} pour {} ({})",
            nouveau ? "créé" : "mis à jour", platformAccountId, userId, platform.getId());
        return saved;
    }

    /**
     * Récupère dans le JSON chiffré les métadonnées utiles au job de refresh :
     *   • {@code expiresIn} (secondes) → {@link UserSocialAccount#tokenExpiresAt} ;
     *   • {@code refreshToken} → {@link UserSocialAccount#refreshTokenEnc} ;
     *   • {@code fbUserId} → {@code extra_account_data} (mapping du deauthorize).
     * Toutes ces clés sont optionnelles, on ne réécrit que les champs présents.
     */
    private void populateTokenMetadata(UserSocialAccount account, String credentialsJson) {
        if (credentialsJson == null || credentialsJson.isBlank()) return;
        try {
            var node = objectMapper.readTree(credentialsJson);

            long expiresIn = node.path("expiresIn").asLong(0);
            if (expiresIn > 0) {
                account.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
            }

            String refreshToken = node.path("refreshToken").asText(null);
            if (refreshToken != null && !refreshToken.isBlank()) {
                account.setRefreshTokenEnc(encryptionService.encrypt(refreshToken));
            }

            String fbUserId = node.path("fbUserId").asText(null);
            if (fbUserId != null && !fbUserId.isBlank()) {
                try {
                    Map<?, ?> existing = account.getExtraAccountData() == null
                        ? Map.of() : objectMapper.readValue(account.getExtraAccountData(), Map.class);
                    Map<String, Object> meta = new java.util.LinkedHashMap<>();
                    existing.forEach((k, v) -> meta.put(String.valueOf(k), v));
                    meta.put("metaUserId", fbUserId);
                    account.setExtraAccountData(objectMapper.writeValueAsString(meta));
                } catch (Exception e) {
                    log.warn("[USER_SOCIAL] extra_account_data illisible, metaUserId ignoré", e);
                }
            }
        } catch (Exception e) {
            log.warn("[USER_SOCIAL] Credentials non interprétables, métadonnées ignorées: {}", e.getMessage());
        }
    }

    /** Passe un canal en soft-delete quand l'utilisateur déconnecte son compte. */
    @Transactional
    public void disconnect(String userId, String platformId, String platformAccountId) {
        String resolved = configService.resolvePlatformId(platformId);
        accountRepository
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse(
                userId, resolved, platformAccountId)
            .ifPresent(account -> {
                account.setDeleted(true);
                account.setStatus("DISCONNECTED");
                account.setAccessTokenEnc(null);
                account.setRefreshTokenEnc(null);
                accountRepository.save(account);
                log.info("[USER_SOCIAL] Compte {} déconnecté pour {}", platformAccountId, userId);
            });
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("[USER_SOCIAL] Sérialisation impossible, valeur brute ignorée", e);
            return "[]";
        }
    }

    /** Lecture pratique pour l'admin : les comptes d'un utilisateur donné. */
    @Transactional(readOnly = true)
    public List<UserSocialAccount> listForUser(String userId) {
        return accountRepository.findByUserIdAndDeletedFalse(userId);
    }

    /** Détail utile au support : l'entité complète, jeton compris (usage interne). */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> describe(String userId, String platformId,
                                                  String platformAccountId) {
        return accountRepository
            .findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse(
                userId, configService.resolvePlatformId(platformId), platformAccountId)
            .map(a -> Map.<String, Object>of(
                "id", a.getId().toString(),
                "platform", a.getPlatform().getId(),
                "accountName", String.valueOf(a.getPlatformAccountName()),
                "status", a.getStatus(),
                "usable", a.isUsable(),
                "scopes", a.getScopesGranted()));
    }
}
