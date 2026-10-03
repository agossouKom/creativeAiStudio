package com.creativeai.agentteam.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Map;

/**
 * Abonne l'application Meta aux événements d'une Page / d'un compte Instagram.
 *
 * <p><b>Pourquoi cette étape est indispensable</b> : vérifier l'URL du webhook
 * (le handshake {@code hub.challenge}) ne suffit PAS. Tant que l'application
 * n'est pas abonnée à l'objet concerné, Meta ne livre aucun événement — et il
 * le fait en silence : aucune erreur, aucun log côté Meta, un tableau de bord
 * qui affiche « actif » et zéro notification reçue. L'abonnement porte le jeton de
 * page, il est donc public et survit à la rotation des jetons utilisateur :
 * contrairement à une copie du jeton dans notre base, il n'a pas à être
 * renouvelé à la main.
 *
 * <p>Endpoints (v24.0) :
 * <pre>
 *   POST /{page-id}/subscribed_apps?access_token={page-token}   → page  + IG rattaché
 *   POST /{ig-user-id}/subscribed_apps?access_token={page-token} → compte IG seul
 * </pre>
 *
 * <p>Best-effort : un échec ici ne doit pas faire échouer la connexion OAuth.
 * L'utilisateur reste publiable, et l'abonnement peut être fait à la main
 * depuis le tableau de bord Meta — mais le journal doit le signaler, sinon la
 * panne (« je ne reçois aucun commentaire ») reste sans explication.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetaWebhookSubscriptionService {

    private final WebClient.Builder            webClientBuilder;
    private final SocialPlatformConfigService platformConfig;

    /**
     * Abonne la Page et, si la Page a un compte Instagram professionnel
     * rattaché, ce compte également.
     *
     * @param pageId          identifiant de la Page Facebook
     * @param pageAccessToken jeton de la Page (porté par l'utilisateur, jamais celui de l'app)
     * @param igUserId        identifiant du compte Instagram, ou {@code null}
     * @return {@code true} si les abonnements applicables sont pris
     */
    public boolean subscribe(String pageId, String pageAccessToken, String igUserId) {
        if (isBlank(pageId) || isBlank(pageAccessToken)) {
            log.warn("[META_WEBHOOK] Abonnement impossible : pageId ou jeton de page vide");
            return false;
        }

        // La Page d'abord : cet appel abonne aussi l'objet Instagram rattaché.
        // L'ignorer laisserait la moitié des notifications dans le vide.
        boolean pageOk = callSubscribedApps(pageId, pageAccessToken);
        if (!pageOk) {
            log.warn("[META_WEBHOOK] Abonnement refusé par Meta pour la page {} — les commentaires ne "
                + "seront PAS reçus par webhook. Reconnecter le compte depuis Workspace, ou s'abonner à la "
                + "main depuis le tableau de bord Meta.", pageId);
            return false;
        }

        if (isBlank(igUserId)) {
            log.info("[META_WEBHOOK] Abonné aux événements de la page {} — pas de compte Instagram rattaché",
                pageId);
            return true;
        }

        boolean igOk = callSubscribedApps(igUserId, pageAccessToken);
        if (igOk) {
            log.info("[META_WEBHOOK] Abonné aux événements — page={} instagram={}", pageId, igUserId);
        } else {
            log.warn("[META_WEBHOOK] Page {} abonnée, mais Meta a refusé l'abonnement du compte Instagram "
                + "{} — les commentaires Instagram ne seront pas reçus par webhook.", pageId, igUserId);
        }
        return igOk;
    }

    /** Un HTTP 2xx vaut succès : c'est le seul signal fiable de cet endpoint. */
    private boolean callSubscribedApps(String objectId, String accessToken) {
        String url = platformConfig.graphBaseUrl("FACEBOOK") + "/" + objectId + "/subscribed_apps"
            + "?access_token=" + accessToken;
        try {
            String body = webClientBuilder.build().post().uri(url)
                .retrieve()
                .bodyToMono(String.class)
                .defaultIfEmpty("")
                .block();
            log.debug("[META_WEBHOOK] subscribed_apps objectId={} → {}", objectId, body);
            return true;
        } catch (WebClientResponseException e) {
            log.warn("[META_WEBHOOK] subscribed_apps HTTP {} pour objectId={} : {}",
                e.getStatusCode(), objectId, e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            log.warn("[META_WEBHOOK] subscribed_apps impossible pour objectId={} : {}", objectId, e.getMessage());
            return false;
        }
    }

    /**
     * Best-effort : journalise l'échec puis rend la main, pour ne jamais faire
     * échouer une connexion OAuth déjà réussie.
     */
    public void subscribeQuietly(String platform, Map<String, Object> creds) {
        if (creds == null) return;
        try {
            subscribe(
                str(creds.get("pageId")),
                str(creds.get("accessToken")),
                str(creds.get("igUserId")));
        } catch (Exception e) {
            log.warn("[OAUTH_{}] Abonnement webhook Meta impossible : {}", platform, e.getMessage());
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}