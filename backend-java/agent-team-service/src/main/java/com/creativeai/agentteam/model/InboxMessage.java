package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.InboxStatus;
import com.creativeai.agentteam.model.enums.MessageDirection;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;

import java.time.LocalDateTime;

@Entity
@Table(name = "inbox_messages", indexes = {
    @Index(name = "idx_inbox_user",      columnList = "user_id"),
    @Index(name = "idx_inbox_agent",     columnList = "agent_id"),
    @Index(name = "idx_inbox_team",      columnList = "team_id"),
    @Index(name = "idx_inbox_channel",   columnList = "channel"),
    @Index(name = "idx_inbox_status",    columnList = "status"),
    @Index(name = "idx_inbox_direction", columnList = "direction"),
    @Index(name = "idx_inbox_conv",      columnList = "conversation_id"),
    @Index(name = "idx_inbox_ext",       columnList = "external_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InboxMessage extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    /** Agent qui a traité / envoyé le message (nullable si équipe sans agent désigné). */
    @Column(name = "agent_id", length = 36)
    private String agentId;

    /** Équipe ayant coordonné le traitement (nullable si agent solo). */
    @Column(name = "team_id", length = 36)
    private String teamId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChannelType channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private MessageDirection direction = MessageDirection.INBOUND;

    /** Expéditeur : email, numéro de téléphone, handle social, etc. */
    @Column(name = "from_address", length = 500)
    private String fromAddress;

    /** Destinataire : email / numéro de l'agent / de la page. */
    @Column(name = "to_address", length = 500)
    private String toAddress;

    /** Objet (pertinent pour EMAIL_SMTP, GMAIL). */
    @Column(length = 1000)
    private String subject;

    /** Corps du message. */
    @Column(columnDefinition = "text")
    private String body;

    /** ID externe chez le provider (évite les doublons sur polling). */
    @Column(name = "external_id", length = 500)
    private String externalId;

    /** Regroupe les messages d'une même conversation/thread. */
    @Column(name = "conversation_id", length = 200)
    private String conversationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private InboxStatus status = InboxStatus.UNREAD;

    /** Liste des pièces jointes (JSON). */
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "CAST(? AS TEXT)::jsonb")
    private String attachments;

    /** Métadonnées canal-spécifiques (ex. messageId WhatsApp, labels Gmail). */
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "CAST(? AS TEXT)::jsonb")
    private String metadata;

    /** Date de réception ou d'envoi du message côté canal externe. */
    @Column(name = "received_at", nullable = false)
    @Builder.Default
    private LocalDateTime receivedAt = LocalDateTime.now();

    /** Agent Scrum qui a livré ce résultat. */
    @Column(name = "scrum_agent_id", length = 36)
    private String scrumAgentId;

    /** Raison du rejet (renseignée lors du PATCH /reject). */
    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;

    /** Date d'approbation (renseignée lors du PATCH /approve). */
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /** URL du fichier généré (.docx) disponible en téléchargement. */
    @Column(name = "file_url", length = 1000)
    private String fileUrl;

    /** Nom du fichier généré. */
    @Column(name = "file_name", length = 500)
    private String fileName;
}
