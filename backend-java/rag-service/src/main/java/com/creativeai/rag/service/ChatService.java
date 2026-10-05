package com.creativeai.rag.service;

import com.creativeai.rag.model.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;

    /** spring.ai.openai.chat.options.model — jamais figé dans le code. */
    @Value("${spring.ai.openai.chat.options.model:}")
    private String modelId;

    /**
     * Identifiant du modèle de chat utilisé ({@code spring.ai.openai.chat.options.model}).
     * Lu depuis la configuration effective pour que l'UI affiche la bonne valeur.
     */
    public String getModelId() {
        return modelId;
    }

    private static final String RAG_TEMPLATE = """
            Contexte documentaire :
            %s

            ---
            Question : %s
            """;

    /**
     * Recherche les documents pertinents puis streame la réponse RAG.
     */
    public Flux<String> streamChat(String question) {
        log.debug("Streaming RAG pour : {}", question);
        String context = buildContext(question);
        String prompt = String.format(RAG_TEMPLATE, context, question);

        return chatClient.prompt()
                .user(prompt)
                .stream()
                .content();
    }

    /**
     * Réponse RAG complète (non-streaming).
     */
    public ChatMessage chat(String question) {
        log.debug("RAG (non-streaming) pour : {}", question);
        String context = buildContext(question);
        String prompt = String.format(RAG_TEMPLATE, context, question);

        String content = chatClient.prompt()
                .user(prompt)
                .call()
                .content();

        return new ChatMessage("assistant", content, Collections.emptyList());
    }

    private String buildContext(String question) {
        try {
            // Seuil 0.0 = pas de filtrage par score (tout contexte est mieux que rien)
            // topK=6 pour avoir plus de contexte cross-documents
            List<Document> docs = vectorStore.similaritySearch(
                    SearchRequest.builder()
                        .query(question)
                        .topK(6)
                        .similarityThreshold(0.0)
                        .build()
            );
            if (docs.isEmpty()) {
                return "(Aucun document indexé — réponds de manière générale)";
            }
            // Inclure le nom du fichier source pour que le LLM sache d'où vient chaque chunk
            return docs.stream()
                    .map(d -> {
                        String src = (String) d.getMetadata().getOrDefault("filename", "inconnu");
                        return "📄 Source : " + src + "\n" + d.getText();
                    })
                    .collect(Collectors.joining("\n\n---\n\n"));
        } catch (Exception e) {
            log.warn("Erreur recherche vectorielle : {}", e.getMessage());
            return "(Base de connaissances indisponible)";
        }
    }
}
