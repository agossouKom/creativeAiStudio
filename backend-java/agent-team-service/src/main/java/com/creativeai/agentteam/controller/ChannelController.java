package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.ChannelRequest;
import com.creativeai.agentteam.dto.request.UpdateChannelRequest;
import com.creativeai.agentteam.dto.response.ChannelResponse;
import com.creativeai.agentteam.service.ChannelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion des canaux de communication par agent.
 *
 * <p>Un canal lie un agent à un service externe (Gmail, WhatsApp, réseau social…).
 * Les credentials sont chiffrées AES-256-GCM avant stockage et ne sont jamais retournées dans les réponses.
 */
@Tag(
    name = "Channels",
    description = """
        Gestion des canaux de communication attachés à un agent.

        Un **canal** est la connexion entre un agent et un service externe.
        Chaque agent peut avoir plusieurs canaux de types différents.

        **Types de canaux (`type`) :**
        | Type | Description |
        |------|-------------|
        | `GMAIL` | Compte Gmail via OAuth2 |
        | `EMAIL_SMTP` | Serveur SMTP/IMAP custom (Outlook, Yahoo, OVH…) |
        | `WHATSAPP` | WhatsApp Business API (Meta) |
        | `TELEGRAM` | Bot Telegram |
        | `SLACK` | Workspace Slack |
        | `SOCIAL_MEDIA` | Réseau social (précisé via `platformType`) |
        | `ONLY_OFFICE` | Instance OnlyOffice |
        | `RXRESUME` | Service RxResume (CV) |
        | `MINIO` | Stockage objet MinIO |
        | `IMAGE_PROVIDER` | Générateur d'images (DALL-E, SD…) |
        | `VIDEO_PROVIDER` | Générateur de vidéos |
        | `WEBHOOK` | Endpoint HTTP entrant/sortant |
        | `CRM` | CRM externe |

        **Cycle de vie :** `DISCONNECTED` → `CONNECTED` | `ERROR` | `EXPIRED`

        ⚠️ Les credentials (`encryptedCredentials`) ne sont **jamais** retournées dans les réponses.

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/agents/{agentId}/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @Operation(
        summary = "Connecter un canal à un agent",
        description = """
            Crée et attache un canal de communication à l'agent.

            Les credentials passées dans `credentials` sont chiffrées AES-256-GCM avant stockage.
            Elles ne sont jamais retournées dans les réponses.

            Après création, le canal est en statut `DISCONNECTED`. Appelez
            `POST /{channelId}/connect` pour le marquer `CONNECTED` une fois la configuration validée.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Gmail OAuth",
                        summary = "Connexion d'une boîte Gmail via OAuth",
                        value = """
                            {
                              "type": "GMAIL",
                              "displayName": "Gmail Marketing",
                              "credentials": "{\\"accessToken\\":\\"ya29.xxx\\",\\"refreshToken\\":\\"1//xxx\\",\\"clientId\\":\\"xxx.apps.googleusercontent.com\\",\\"clientSecret\\":\\"GOCSPX-xxx\\"}",
                              "accountId": "marketing@company.com",
                              "accountName": "Marketing Bot"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "SMTP custom",
                        summary = "Serveur SMTP Outlook / OVH",
                        value = """
                            {
                              "type": "EMAIL_SMTP",
                              "displayName": "Serveur Mail Pro",
                              "credentials": "{\\"smtpHost\\":\\"smtp.office365.com\\",\\"smtpPort\\":587,\\"imapHost\\":\\"outlook.office365.com\\",\\"imapPort\\":993,\\"user\\":\\"bot@company.com\\",\\"password\\":\\"secret\\"}",
                              "accountId": "bot@company.com",
                              "accountName": "Bot CRM"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "WhatsApp Business",
                        summary = "Connexion WhatsApp Business API (Meta)",
                        value = """
                            {
                              "type": "WHATSAPP",
                              "displayName": "WhatsApp Support",
                              "credentials": "{\\"phoneNumberId\\":\\"1234567890\\",\\"accessToken\\":\\"EAAxxxxx\\",\\"webhookVerifyToken\\":\\"my-secret-token\\"}",
                              "accountId": "+33612345678",
                              "accountName": "Support Client",
                              "config": "{\\"webhookUrl\\":\\"https://api.company.com/webhooks/whatsapp/AGENT_ID\\"}"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Instagram (Social Media)",
                        summary = "Connexion compte Instagram",
                        value = """
                            {
                              "type": "SOCIAL_MEDIA",
                              "platformType": "INSTAGRAM",
                              "displayName": "Instagram @company",
                              "credentials": "{\\"accessToken\\":\\"IGQVJxxxxx\\",\\"pageId\\":\\"1234567890\\"}",
                              "accountId": "@company",
                              "accountName": "Company Instagram"
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Canal créé (statut DISCONNECTED)"),
        @ApiResponse(responseCode = "400", description = "Champs invalides"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @PostMapping
    public ResponseEntity<ChannelResponse> create(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody ChannelRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(channelService.createChannel(userId, agentId, req));
    }

    @Operation(
        summary = "Lister les canaux d'un agent",
        description = "Retourne tous les canaux actifs (non supprimés) de l'agent."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Liste des canaux"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @GetMapping
    public ResponseEntity<List<ChannelResponse>> list(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        return ResponseEntity.ok(channelService.listChannels(userId, agentId));
    }

    @Operation(
        summary = "Obtenir un canal",
        description = "Retourne le détail d'un canal. Les credentials ne sont pas incluses."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détail du canal"),
        @ApiResponse(responseCode = "404", description = "Canal ou agent introuvable")
    })
    @GetMapping("/{channelId}")
    public ResponseEntity<ChannelResponse> get(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal") @PathVariable String channelId) {
        return ResponseEntity.ok(channelService.getChannel(userId, agentId, channelId));
    }

    @Operation(
        summary = "Modifier un canal",
        description = """
            Met à jour la configuration d'un canal. Seuls les champs fournis sont modifiés.
            Passer `credentials` met à jour les credentials chiffrées.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Canal mis à jour"),
        @ApiResponse(responseCode = "404", description = "Canal ou agent introuvable")
    })
    @PutMapping("/{channelId}")
    public ResponseEntity<ChannelResponse> update(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal") @PathVariable String channelId,
            @RequestBody UpdateChannelRequest req) {
        return ResponseEntity.ok(channelService.updateChannel(userId, agentId, channelId, req));
    }

    @Operation(
        summary = "Marquer le canal comme connecté",
        description = "Passe le statut du canal à `CONNECTED`. À appeler après validation des credentials côté provider."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Canal connecté"),
        @ApiResponse(responseCode = "404", description = "Canal introuvable")
    })
    @PostMapping("/{channelId}/connect")
    public ResponseEntity<ChannelResponse> connect(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal") @PathVariable String channelId) {
        return ResponseEntity.ok(channelService.connect(userId, agentId, channelId));
    }

    @Operation(
        summary = "Déconnecter un canal",
        description = "Passe le statut du canal à `DISCONNECTED`. L'agent ne pourra plus envoyer/recevoir via ce canal."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Canal déconnecté"),
        @ApiResponse(responseCode = "404", description = "Canal introuvable")
    })
    @PostMapping("/{channelId}/disconnect")
    public ResponseEntity<ChannelResponse> disconnect(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal") @PathVariable String channelId) {
        return ResponseEntity.ok(channelService.disconnect(userId, agentId, channelId));
    }

    @Operation(
        summary = "Supprimer un canal (soft delete)",
        description = "Marque le canal comme supprimé et le passe à `DISCONNECTED`. Récupérable via `POST /{channelId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Canal supprimé"),
        @ApiResponse(responseCode = "404", description = "Canal introuvable")
    })
    @DeleteMapping("/{channelId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal") @PathVariable String channelId) {
        channelService.deleteChannel(userId, agentId, channelId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(summary = "Lister les canaux supprimés d'un agent",
               description = "Retourne les canaux dont `deleted=true` pour cet agent.")
    @ApiResponse(responseCode = "200", description = "Liste des canaux supprimés")
    @GetMapping("/deleted")
    public ResponseEntity<List<ChannelResponse>> listDeleted(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        return ResponseEntity.ok(channelService.listDeletedChannels(userId, agentId));
    }

    @Operation(summary = "Restaurer un canal supprimé",
               description = "Remet `deleted=false` et le statut à `DISCONNECTED`. À reconnecter manuellement après restauration.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Canal restauré"),
        @ApiResponse(responseCode = "404", description = "Canal supprimé introuvable")
    })
    @PostMapping("/{channelId}/restore")
    public ResponseEntity<ChannelResponse> restore(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent")  @PathVariable String agentId,
            @Parameter(description = "UUID du canal supprimé") @PathVariable String channelId) {
        return ResponseEntity.ok(channelService.restoreChannel(userId, agentId, channelId));
    }
}
