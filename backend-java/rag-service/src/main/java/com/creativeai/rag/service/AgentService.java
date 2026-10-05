package com.creativeai.rag.service;

import com.creativeai.rag.model.AgentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service central pour tous les agents IA du module Agentique.
 * Utilise le même ChatClient que le service RAG (modèle configuré par
 * RAG_CHAT_MODEL / DEFAULT_MODEL, aucun modèle figé dans le code).
 *
 * Le champ `context` de AgentRequest contient le bloc [CONTEXTE UTILISATEUR]
 * construit côté Angular — il inclut nom, email, rôle, crédits de l'utilisateur
 * connecté. Ce bloc est injecté en system prompt pour personnaliser chaque réponse.
 * Si l'utilisateur n'est pas connecté, le bloc l'indique et le LLM l'invite à se connecter.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;

    // ── Agent Email ──────────────────────────────────────────────────────────

    public Flux<String> streamEmailAnalysis(AgentRequest req) {
        String prompt = buildEmailPrompt(req);
        log.debug("Agent Email [{}] streaming", req.type());
        return chatClient.prompt().user(prompt).stream().content();
    }

    private String buildEmailPrompt(AgentRequest req) {
        String userCtx = req.context() != null ? req.context() : "";

        // Extraire le nom de l'utilisateur pour la signature des réponses
        String userName = extractUserName(userCtx);
        String signOff  = userName.isEmpty() ? "Cordialement" : "Cordialement,\n" + userName;

        return switch (req.type() == null ? "summary" : req.type()) {
            case "reply" -> """
                    %s

                    Tu es un assistant email professionnel francophone.
                    Génère une réponse professionnelle, concise et courtoise à cet email.
                    Utilise le nom de l'expéditeur indiqué dans le contexte utilisateur pour la signature.
                    Signe avec : "%s"

                    Email à répondre :
                    %s
                    """.formatted(userCtx, signOff, req.content());

            case "task" -> """
                    %s

                    Tu es un assistant de productivité.
                    Extrais UNIQUEMENT les tâches et actions concrètes à réaliser depuis cet email.
                    Format : liste bullet points avec priorité et délai si mentionné.
                    Adresse-toi à l'utilisateur par son prénom si disponible dans le contexte.

                    Email :
                    %s
                    """.formatted(userCtx, req.content());

            case "urgency" -> """
                    %s

                    Évalue le niveau d'urgence de cet email pour l'utilisateur.
                    Réponds avec : niveau (CRITIQUE/ÉLEVÉ/MODÉRÉ/FAIBLE/NUL), justification en 1 phrase, délai recommandé.
                    Tiens compte du rôle de l'utilisateur si disponible pour adapter le conseil.

                    Email :
                    %s
                    """.formatted(userCtx, req.content());

            default -> """
                    %s

                    Tu es un assistant email IA. Résume cet email en 3 points clés maximum.
                    Format : points bullet courts et percutants. Langue : français.
                    Adresse-toi à l'utilisateur par son prénom si disponible dans le contexte.

                    Email :
                    %s
                    """.formatted(userCtx, req.content());
        };
    }

    // ── Agent Résumé de document ─────────────────────────────────────────────

    public Flux<String> streamDocumentResume(AgentRequest req) {
        // Si un document est indexé dans le vector store, l'enrichir avec du contexte RAG
        String ragContext = buildRagContext(req.content());
        String prompt = """
                Tu es un expert en analyse documentaire. Analyse ce texte et fournis :

                **RÉSUMÉ EXÉCUTIF** (3-5 phrases max) :

                **DÉCISIONS CLÉS** :
                - (bullet points)

                **ACTIONS À ENTREPRENDRE** :
                1. (liste numérotée)

                **MOTS-CLÉS** : (séparés par virgule)

                %s

                Texte à analyser :
                %s
                """.formatted(ragContext.isEmpty() ? "" : "Contexte complémentaire :\n" + ragContext, req.content());

        log.debug("Agent Résumé streaming");
        return chatClient.prompt().user(prompt).stream().content();
    }

    // ── Agent Marketing ──────────────────────────────────────────────────────

    public Flux<String> streamMarketingContent(AgentRequest req) {
        String platform = req.context() != null ? req.context() : "LinkedIn";
        String prompt = switch (req.type() == null ? "social" : req.type()) {
            case "seo" -> """
                    Rédige un article SEO optimisé en français sur : %s
                    Structure : Titre H1, introduction accrocheuse, 3 sections H2 avec contenu, conclusion + CTA.
                    Intègre naturellement les mots-clés pertinents.
                    """.formatted(req.content());

            case "hashtags" -> """
                    Génère 15 hashtags pertinents pour ce sujet sur %s : %s
                    Mix : 5 très populaires (#Marketing #IA), 5 moyens, 5 niche.
                    Format : #hashtag séparés par espaces. Pas d'explication.
                    """.formatted(platform, req.content());

            case "campaign" -> """
                    Crée un email marketing pour : %s
                    Fournis : Objet A/B (2 options), accroche, corps (3 sections), CTA fort.
                    Ton : professionnel mais engageant. Langue : français.
                    """.formatted(req.content());

            case "script" -> """
                    Écris un script vidéo YouTube/TikTok (2-3 minutes) sur : %s
                    Structure : Hook (10s) → Problème → Solution → Preuve → CTA.
                    Inclure les temps approximatifs. Ton dynamique et engageant.
                    """.formatted(req.content());

            default -> """
                    Crée un post %s percutant sur : %s
                    Inclus : accroche forte, 3 points clés, emoji pertinents, call-to-action.
                    Max 300 mots. Ton professionnel et engageant.
                    """.formatted(platform, req.content());
        };

        log.debug("Agent Marketing [{}] streaming", req.type());
        return chatClient.prompt().user(prompt).stream().content();
    }

    // ── Agent Slides ─────────────────────────────────────────────────────────

    public Flux<String> streamSlidesContent(AgentRequest req) {
        int slideCount = 8;
        try {
            if (req.context() != null && req.context().matches("\\d+"))
                slideCount = Integer.parseInt(req.context());
        } catch (NumberFormatException ignored) {}

        String prompt = """
                Tu es un expert en création de présentations professionnelles.
                Génère le contenu de %d slides pour une présentation sur : %s

                Pour chaque slide, fournis :
                [SLIDE N] Type: TITRE|CONTENU|STATS|CITATION|CONCLUSION
                Titre: ...
                • Point 1
                • Point 2
                • Point 3

                Commence par un slide titre, termine par un slide conclusion/CTA.
                Langue : français. Style : professionnel et percutant.
                """.formatted(slideCount, req.content());

        log.debug("Agent Slides streaming ({} slides)", slideCount);
        return chatClient.prompt().user(prompt).stream().content();
    }

    // ── Agent Prospection ─────────────────────────────────────────────────────

    public Flux<String> streamProspectionMessage(AgentRequest req) {
        String prompt = switch (req.type() == null ? "linkedin" : req.type()) {
            case "email" -> """
                    Rédige un email de prospection commerciale froid et efficace.
                    Prospect : %s
                    Proposition de valeur : %s

                    Structure : Objet percutant, accroche personnalisée, valeur ajoutée concise, preuves sociales, CTA clair.
                    Max 200 mots. Ton : professionnel sans être robotique.
                    """.formatted(req.content(), req.context() != null ? req.context() : "");

            case "followup" -> """
                    Rédige une relance professionnelle et non-intrusive pour : %s
                    Contexte : %s

                    Ton bienveillant, rappel de la valeur, nouvelle proposition d'action simple.
                    Max 100 mots.
                    """.formatted(req.content(), req.context() != null ? req.context() : "");

            default -> """
                    Rédige un message LinkedIn de prospection percutant et personnalisé.
                    Prospect : %s
                    Proposition : %s

                    Structure : Accroche personnalisée (commun/intérêt) → valeur en 1 phrase → question ouverte.
                    Max 300 caractères. Direct, humain, sans jargon commercial.
                    """.formatted(req.content(), req.context() != null ? req.context() : "");
        };

        log.debug("Agent Prospection [{}] streaming", req.type());
        return chatClient.prompt().user(prompt).stream().content();
    }

    // ── Agent CV Analyzer ─────────────────────────────────────────────────────

    public Flux<String> streamCvAnalysis(AgentRequest req) {
        String targetJob = req.context() != null && !req.context().isBlank()
                ? "Poste ciblé : " + req.context() + "\n"
                : "";

        // Rechercher des offres/exigences similaires dans le vector store
        String ragContext = buildRagContext(req.context() != null ? req.context() : "CV analyse");

        String prompt = """
                Tu es un expert RH et consultant en évolution professionnelle.
                Analyse ce CV de manière détaillée et professionnelle.
                %s
                %s

                Fournis une analyse structurée :

                **SCORE GLOBAL** : X/100
                **SCORE ATS** : X%%
                **ÉVALUATION** : (Excellent/Bon/À améliorer)

                **ANALYSE PAR SECTION** :
                - Résumé professionnel : X/100 — (commentaire)
                - Expériences : X/100 — (commentaire)
                - Compétences : X/100 — (commentaire)
                - Formation : X/100 — (commentaire)
                - Format/Lisibilité : X/100 — (commentaire)

                **MOTS-CLÉS PRÉSENTS** : (liste)
                **MOTS-CLÉS MANQUANTS** : (à ajouter)

                **POINTS FORTS** :
                • ...

                **AXES D'AMÉLIORATION** :
                1. ...

                **POSTES SUGGÉRÉS** : (3-5 postes correspondant au profil)

                CV à analyser :
                %s
                """.formatted(
                targetJob,
                ragContext.isEmpty() ? "" : "Contexte sectoriel :\n" + ragContext + "\n",
                req.content()
        );

        log.debug("Agent CV Analyzer streaming");
        return chatClient.prompt().user(prompt).stream().content();
    }

    // ── Utilitaires ───────────────────────────────────────────────────────────

    /** Extrait le nom de l'utilisateur depuis le bloc [CONTEXTE UTILISATEUR] */
    private String extractUserName(String context) {
        if (context == null || context.isBlank()) return "";
        for (String line : context.split("\n")) {
            if (line.startsWith("Nom complet")) {
                String[] parts = line.split(":", 2);
                return parts.length > 1 ? parts[1].trim() : "";
            }
        }
        return "";
    }

    private String buildRagContext(String query) {
        if (query == null || query.isBlank()) return "";
        try {
            List<Document> docs = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query(query)
                            .topK(3)
                            .similarityThreshold(0.0)
                            .build()
            );
            if (docs.isEmpty()) return "";
            return docs.stream()
                    .map(d -> d.getText())
                    .collect(Collectors.joining("\n\n"));
        } catch (Exception e) {
            log.warn("RAG context unavailable: {}", e.getMessage());
            return "";
        }
    }
}
