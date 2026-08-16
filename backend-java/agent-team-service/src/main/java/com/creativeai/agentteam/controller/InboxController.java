package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.InboxMessageRequest;
import com.creativeai.agentteam.dto.request.InboxReplyRequest;
import com.creativeai.agentteam.dto.response.InboxMessageResponse;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.InboxStatus;
import com.creativeai.agentteam.model.enums.MessageDirection;
import com.creativeai.agentteam.service.InboxService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Boîte de réception unifiée — tous les messages entrants et sortants, tous canaux confondus.
 */
@Tag(
    name = "Inbox",
    description = """
        Boîte de réception unifiée pour tous les messages traités par les agents.

        L'**Inbox** centralise les échanges effectués via tous les canaux :
        Gmail, SMTP, WhatsApp, Telegram, Slack, Réseaux sociaux…

        **Trier / Filtrer :**
        - Par **équipe** : `?teamId=`
        - Par **agent** : `?agentId=`
        - Par **canal** : `?channel=WHATSAPP`
        - Par **statut** : `?status=UNREAD`
        - Par **direction** : `?direction=INBOUND`
        - Par **conversation** : `?conversationId=` (regroupe un thread)
        - **Recherche** dans le corps/objet/expéditeur : `?search=relance`

        **Statuts d'un message :**
        | Statut | Signification |
        |--------|---------------|
        | `UNREAD` | Reçu, non lu |
        | `READ` | Ouvert par l'utilisateur |
        | `REPLIED` | Agent a répondu |
        | `ARCHIVED` | Archivé (reste visible dans l'historique) |

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/inbox")
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inboxService;

    @Operation(
        summary = "Lister les messages de l'inbox",
        description = """
            Retourne les messages paginés de l'utilisateur, avec filtres optionnels cumulables.

            **Exemples d'usage :**
            - Tous les WhatsApp non lus : `?channel=WHATSAPP&status=UNREAD`
            - Messages d'une équipe : `?teamId=xxx`
            - Messages envoyés par un agent : `?agentId=xxx&direction=OUTBOUND`
            - Recherche dans les emails : `?channel=GMAIL&search=relance`
            - Thread complet : `?conversationId=thread-abc123`

            **Tri** : par `received_at` décroissant (plus récent en premier).
            """
    )
    @ApiResponse(responseCode = "200", description = "Page de messages")
    @GetMapping
    public ResponseEntity<Page<InboxMessageResponse>> list(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Filtrer par agent", example = "d82a47a7-938d-4ff3-a8be-46da5579357c")
            @RequestParam(required = false) String agentId,
            @Parameter(description = "Filtrer par équipe", example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
            @RequestParam(required = false) String teamId,
            @Parameter(description = "Filtrer par canal", example = "WHATSAPP")
            @RequestParam(required = false) ChannelType channel,
            @Parameter(description = "Filtrer par statut", example = "UNREAD")
            @RequestParam(required = false) InboxStatus status,
            @Parameter(description = "Filtrer par direction", example = "INBOUND")
            @RequestParam(required = false) MessageDirection direction,
            @Parameter(description = "Filtrer par ID de conversation (thread)")
            @RequestParam(required = false) String conversationId,
            @Parameter(description = "Recherche dans le corps, l'objet ou l'expéditeur", example = "relance")
            @RequestParam(required = false) String search,
            @Parameter(description = "Page (0-based)", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de page", example = "20")
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(inboxService.search(
            userId, agentId, teamId, channel, status, direction, conversationId, search,
            PageRequest.of(page, size)));
    }

    @Operation(
        summary = "Nombre de messages non lus",
        description = "Retourne le compteur de messages `UNREAD` pour l'utilisateur. Utile pour le badge de notification."
    )
    @ApiResponse(responseCode = "200", description = "Compteur non lus")
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(Map.of("unread", inboxService.countUnread(userId)));
    }

    @Operation(
        summary = "Obtenir un message",
        description = "Retourne le détail complet d'un message, incluant le corps et les métadonnées canal."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détail du message"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @GetMapping("/{messageId}")
    public ResponseEntity<InboxMessageResponse> get(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId) {
        return ResponseEntity.ok(inboxService.getMessage(userId, messageId));
    }

    @Operation(
        summary = "Créer / enregistrer un message",
        description = """
            Enregistre un message dans l'inbox. Principalement utilisé pour :
            - Stocker les messages **entrants** reçus via webhook (email, WhatsApp…)
            - Enregistrer les messages **sortants** envoyés par les agents

            Ce endpoint ne déclenche **pas** l'envoi réel — il sert uniquement à l'archivage.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Email entrant",
                        summary = "Email reçu d'un client",
                        value = """
                            {
                              "agentId": "d82a47a7-938d-4ff3-a8be-46da5579357c",
                              "channel": "GMAIL",
                              "direction": "INBOUND",
                              "fromAddress": "client@example.com",
                              "toAddress": "bot@company.com",
                              "subject": "Demande de relance facture",
                              "body": "Bonjour, je n'ai pas reçu ma facture du mois de mai.",
                              "conversationId": "thread-gmail-abc123"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "WhatsApp entrant",
                        summary = "Message WhatsApp d'un prospect",
                        value = """
                            {
                              "agentId": "d82a47a7-938d-4ff3-a8be-46da5579357c",
                              "channel": "WHATSAPP",
                              "direction": "INBOUND",
                              "fromAddress": "+33612345678",
                              "toAddress": "+33700000000",
                              "body": "Bonjour, je voudrais en savoir plus sur vos services.",
                              "externalId": "wamid.HBgxxxxxx",
                              "conversationId": "+33612345678"
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Message enregistré dans l'inbox"),
        @ApiResponse(responseCode = "400", description = "Champs invalides")
    })
    @PostMapping
    public ResponseEntity<InboxMessageResponse> create(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody InboxMessageRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(inboxService.createMessage(userId, req));
    }

    @Operation(
        summary = "Changer le statut d'un message",
        description = """
            Met à jour le statut d'un message.

            **Transitions typiques :**
            - `UNREAD` → `READ` (ouverture du message)
            - `READ` → `REPLIED` (réponse envoyée)
            - `READ` / `REPLIED` → `ARCHIVED` (archivage)
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statut mis à jour"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @PatchMapping("/{messageId}/status")
    public ResponseEntity<InboxMessageResponse> updateStatus(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId,
            @Parameter(description = "Nouveau statut", example = "READ")
            @RequestParam InboxStatus status) {
        return ResponseEntity.ok(inboxService.updateStatus(userId, messageId, status));
    }

    @Operation(
        summary = "Supprimer un message (soft delete)",
        description = "Masque le message de l'inbox. Il reste dans la base et est récupérable via `POST /{messageId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Message supprimé"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @DeleteMapping("/{messageId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId) {
        inboxService.deleteMessage(userId, messageId);
        return ResponseEntity.noContent().build();
    }

    // ── Approbation / Rejet ───────────────────────────────────────────────

    @Operation(
        summary = "Préparer une réponse en attente d'approbation",
        description = "Stocke un brouillon de réponse associé au message, et le marque `PENDING_APPROVAL` pour un contrôle humain."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Brouillon enregistré"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @PatchMapping("/{messageId}/prepare-reply")
    public ResponseEntity<InboxMessageResponse> prepareReply(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId,
            @Valid @RequestBody InboxReplyRequest req) {
        return ResponseEntity.ok(inboxService.prepareReply(userId, messageId, req.replySubject(), req.replyBody()));
    }

    @Operation(
        summary = "Envoyer immédiatement une réponse",
        description = "Envoie la réponse directement via SMTP et marque le message comme `REPLIED`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Réponse envoyée"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @PostMapping("/{messageId}/send-reply")
    public ResponseEntity<InboxMessageResponse> sendReply(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId,
            @Valid @RequestBody InboxReplyRequest req) {
        return ResponseEntity.ok(inboxService.sendReply(userId, messageId, req.replySubject(), req.replyBody()));
    }

    @Operation(
        summary = "Approuver un message",
        description = "Passe le statut à `APPROVED` et enregistre la date d'approbation. Si un brouillon de réponse est associé au message, il est envoyé automatiquement à l'approbation."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Message approuvé"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @PatchMapping("/{messageId}/approve")
    public ResponseEntity<InboxMessageResponse> approve(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId) {
        return ResponseEntity.ok(inboxService.approve(userId, messageId));
    }

    @Operation(
        summary = "Rejeter un message",
        description = "Passe le statut à `REJECTED` avec une raison optionnelle."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Message rejeté"),
        @ApiResponse(responseCode = "404", description = "Message introuvable")
    })
    @PatchMapping("/{messageId}/reject")
    public ResponseEntity<InboxMessageResponse> reject(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message") @PathVariable String messageId,
            @Parameter(description = "Raison du rejet (optionnel)", example = "Ton inadapté")
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(inboxService.reject(userId, messageId, reason));
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(summary = "Messages supprimés",
               description = "Retourne les messages dont `deleted=true`, paginés.")
    @ApiResponse(responseCode = "200", description = "Messages supprimés")
    @GetMapping("/deleted")
    public ResponseEntity<Page<InboxMessageResponse>> listDeleted(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Page", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille", example = "20") @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(inboxService.listDeleted(userId, PageRequest.of(page, size)));
    }

    @Operation(summary = "Restaurer un message supprimé",
               description = "Remet `deleted=false`. Le message réapparaît dans `GET /api/inbox`.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Message restauré"),
        @ApiResponse(responseCode = "404", description = "Message supprimé introuvable")
    })
    @PostMapping("/{messageId}/restore")
    public ResponseEntity<InboxMessageResponse> restore(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du message supprimé") @PathVariable String messageId) {
        return ResponseEntity.ok(inboxService.restoreMessage(userId, messageId));
    }

}
