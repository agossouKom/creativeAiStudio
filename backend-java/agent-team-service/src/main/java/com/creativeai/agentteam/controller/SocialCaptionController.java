package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.llm.LlmGateway;
import com.creativeai.agentteam.service.AgentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Rédaction assistée des légendes de publication.
 *
 * <p>Dans l'onglet Planning, l'utilisateur décrit son événement en une phrase et
 * demande un texte court prêt à publier. Sans cela il devrait écrire deux fois
 * la même chose : une fois pour la génération, une fois pour le post.
 *
 * <p>Le modèle ne fait que reformuler ce que l'utilisateur a décrit : il n'a
 * droit ni d'inventer un prix, une date, une adresse, ni de promettre quoi que
 * ce soit. C'est ce qui rend la sortie publiable sans relecture.
 */
@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialCaptionController {

    /** Au-delà, les plateformes tronquent ou refusent la publication. */
    private static final int MAX_LENGTH = 2200;
    private static final int TARGET_LENGTH = 400;

    private final LlmGateway     llmGateway;
    private final AgentService   agentService;

    public record CaptionRequest(
        @NotBlank(message = "La description de l'événement est obligatoire")
        @Size(max = 2000, message = "La description ne doit pas dépasser 2000 caractères")
        String event,

        /** Ton souhaité : « commercial », « institutionnel », « festif »… */
        @Size(max = 64, message = "Le ton ne doit pas dépasser 64 caractères")
        String tone,

        /** Plateforme cible : la longueur et les usages diffèrent. */
        @Size(max = 30, message = "La plateforme ne doit pas dépasser 30 caractères")
        String platform,

        @Size(max = 64, message = "L'agent ne doit pas dépasser 64 caractères")
        String agentId
    ) {}

    @PostMapping("/caption")
    public ResponseEntity<Map<String, Object>> generateCaption(
        @AuthenticationPrincipal String userId,
        @Valid @RequestBody CaptionRequest request) {

        // Le provider LLM est déduit de l'agent. Sans ce contrôle, n'importe quel
        // utilisateur authentifié pouvait passer l'agentId d'autrui et déclencher
        // un appel payé avec la clé du propriétaire (tier 3 de la résolution).
        // 404 et non 403 : un agent possédé par autrui ne doit pas être
        // distinguable d'un agent absent.
        if (request.agentId() == null || request.agentId().isBlank()) {
            throw new IllegalArgumentException("agentId est obligatoire pour générer une légende");
        }
        agentService.requireOwnedAgent(userId, request.agentId());

        String platform = (request.platform() == null || request.platform().isBlank())
            ? "réseaux sociaux" : request.platform();
        String tone = (request.tone() == null || request.tone().isBlank())
            ? "professionnel et chaleureux" : request.tone();

        String systemPrompt = """
            Tu rédiges des légendes courtes pour des publications sur les réseaux sociaux.

            Règles strictes :
            - Français uniquement, ton accordé au ton demandé.
            - Maximum %d caractères, environ %d en pratique.
            - N'invente JAMAIS d'information : pas de prix, pas de date, pas d'adresse,
              pas de promotion, pas de promesse. Si une donnée manque, ne l'invente pas.
            - Utilise uniquement les informations présentes dans la description de l'utilisateur.
            - Pas de hashtag sauf si l'utilisateur en demande explicitement.
            - Retourne uniquement le texte de la légende, sans préambule ni guillemets
              et sans commentaire.
            """.formatted(MAX_LENGTH, TARGET_LENGTH);

        String userPrompt = "Plateforme : %s%nTon : %s%n%nDescription de l'événement :%n%s"
            .formatted(platform, tone, request.event().strip());

        String raw = llmGateway.completeText(request.agentId(), systemPrompt, userPrompt);
        String caption = sanitize(raw);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("caption", caption);
        out.put("length", caption.length());
        out.put("maxLength", MAX_LENGTH);
        out.put("user", userId);
        return ResponseEntity.ok(out);
    }

    /**
     * Les modèles enveloppent parfois la réponse dans des guillemets, un bloc
     * ``` ou un préambule du type « Voici votre légende : ». Tout cela partirait
     * littéralement sur le réseau social.
     */
    private String sanitize(String raw) {
        if (raw == null) {
            return "";
        }
        String text = raw.strip();
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            int closing = text.lastIndexOf("```");
            if (firstNewline > 0 && closing > firstNewline) {
                text = text.substring(firstNewline + 1, closing);
            }
        }
        text = text.strip();
        // Guillemets enveloppants, une seule paire.
        if (text.length() > 1
            && ((text.startsWith("\"") && text.endsWith("\""))
             || (text.startsWith("«") && text.endsWith("»")))) {
            text = text.substring(1, text.length() - 1).strip();
        }
        if (text.length() > MAX_LENGTH) {
            // Coupure sur un espace, sinon on laisse une coupure en milieu de mot.
            int cut = text.lastIndexOf(' ', MAX_LENGTH);
            text = text.substring(0, cut > 0 ? cut : MAX_LENGTH).strip() + "…";
        }
        return text;
    }
}
