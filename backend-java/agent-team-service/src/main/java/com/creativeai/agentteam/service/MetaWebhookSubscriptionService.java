package com.creativeai.agentteam.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
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
        boolean pageOk = callSubscribedApps(pageId, pageAccessToken, PAGE_FIELDS);
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

        boolean igOk = callSubscribedApps(igUserId, pageAccessToken, INSTAGRAM_FIELDS);
        if (igOk) {
            log.info("[META_WEBHOOK] Abonné aux événements — page={} instagram={}", pageId, igUserId);
        } else {
            log.warn("[META_WEBHOOK] Page {} abonnée, mais pas d'abonnement direct du compte Instagram "
                + "{} — les événements IG continueront d'arriver tant que l'abonnement à la Page est "
                + "valide ; un abonnement direct exige les capacités Instagram de l'application.",
                pageId, igUserId);
        }
        return igOk;
    }

    /**
     * Champs pour lesquels on demande la livraison, alignés sur ce que les
     * contrôleurs de webhook savent réellement traiter.
     *
     * <p>Attention : la liste n'est pas celle des cases à cocher du tableau de
     * bord. Meta ne l'accepte que si <b>tous</b> les champs sont valides, et un
     * seul champ inconnu fait échouer tout l'appel en 400
     * ({@code (#100) Param subscribed_fields[n] must be one of {...}}) — donc
     * l'abonnement part à la poubelle et plus aucun événement n'arrive. Pour une
     * Page, {@code comments} n'existe pas : les commentaires sur les publications
     * arrivent par {@code feed} (événement {@code comment}). {@code mention}
     * couvre les tags de la Page.
     */
    private static final String PAGE_FIELDS      = "feed,mention";
    private static final String INSTAGRAM_FIELDS = "comments,live_comments,mentions";

    /** Un HTTP 2xx vaut succès : c'est le seul signal fiable de cet endpoint. */
    private boolean callSubscribedApps(String objectId, String accessToken, String subscribedFields) {
        String url = platformConfig.graphBaseUrl("FACEBOOK") + "/" + objectId + "/subscribed_apps"
            + "?access_token=" + accessToken;
        // Meta refuse l'appel sans `subscribed_fields` ("(#100) The parameter
        // subscribed_fields is required") : il doit être envoyé en form, pas en
        // query — sinon l'abonnement échoue et aucun événement n'arrive jamais.
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("subscribed_fields", subscribedFields);
        try {
            String body = webClientBuilder.build().post().uri(url)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .bodyToMono(String.class)
                .defaultIfEmpty("")
                .block();
            log.debug("[META_WEBHOOK] subscribed_apps objectId={} fields={} → {}", objectId, subscribedFields, body);
            return true;
        } catch (WebClientResponseException e) {
            String body = e.getResponseBodyAsString();
            // (#3) "Application does not have the capability to make this API call" :
            // ce n'est pas une panne de notre côté, c'est l'app qui n'a pas la
            // capacité Instagram demandée. Un ERROR ici ferait croire à une
            // subscription perdue alors que la Page, elle, est bien abonnée.
            if (body.contains("(#3)") || body.contains("\"code\":3")) {
                log.info("[META_WEBHOOK] Pas d'abonnement direct de l'objet {} : l'application Meta n'a pas "
                    + "la capacité correspondante ({})", objectId, body);
                return false;
            }
            log.warn("[META_WEBHOOK] subscribed_apps HTTP {} pour objectId={} : {}",
                e.getStatusCode(), objectId, body);
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