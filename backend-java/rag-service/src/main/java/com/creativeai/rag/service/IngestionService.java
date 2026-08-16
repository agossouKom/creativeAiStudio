package com.creativeai.rag.service;

import com.creativeai.rag.model.IngestResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class IngestionService {

    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;
    private final ChatModel chatModel;

    @Value("${groq.vision.model:meta-llama/llama-4-scout-17b-16e-instruct}")
    private String visionModel;

    // ChatClient dédié à la vision — pas de system prompt RAG
    private ChatClient visionClient;

    @PostConstruct
    void init() {
        this.visionClient = ChatClient.builder(chatModel).build();
    }

    private static final int CHUNK_SIZE    = 800;
    private static final int CHUNK_OVERLAP = 100;

    private static final String VISION_PROMPT = """
            Tu es un assistant spécialisé dans l'analyse d'images pour un système RAG.
            Analyse cette image,ce pdf,doc,docx,texte,md, de façon exhaustive et décris :
            - Tous les textes, titres, étiquettes et données visibles
            - Les diagrammes, schémas, architectures, tableaux
            - Les logos, marques, technologies mentionnées
            - Les personnes, objets, scènes importantes
            - Les couleurs et éléments graphiques significatifs
            L'objectif est de permettre une recherche sémantique précise sur ce contenu.
            Réponds en français de façon structurée et détaillée.
            """;

    /** Indexation d'un document texte via Apache Tika. */
    public IngestResponse ingest(MultipartFile file) {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        log.info("Ingesting document: {} ({} bytes)", filename, file.getSize());
        try {
            TikaDocumentReader reader = new TikaDocumentReader(new InputStreamResource(file.getInputStream()));
            List<Document> rawDocs = reader.get();

            if (rawDocs.isEmpty())
                return new IngestResponse(filename, 0, "error", "Le document ne contient aucun texte lisible");

            String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1) : "unknown";
            for (Document doc : rawDocs) {
                doc.getMetadata().putAll(Map.of(
                        "filename", filename, "fileType", ext,
                        "fileSize", String.valueOf(file.getSize()),
                        "ingestedAt", Instant.now().toString()));
            }

            TokenTextSplitter splitter = new TokenTextSplitter(CHUNK_SIZE, CHUNK_OVERLAP, 5, 10000, true);
            List<Document> chunks = splitter.apply(rawDocs);
            vectorStore.add(chunks);

            log.info("Ingested {} chunks from {}", chunks.size(), filename);
            return new IngestResponse(filename, chunks.size(), "success",
                    String.format("%d chunk(s) depuis %s (%.1f Ko)", chunks.size(), filename, file.getSize() / 1024.0));

        } catch (Exception e) {
            log.error("Error ingesting {}: {}", filename, e.getMessage(), e);
            return new IngestResponse(filename, 0, "error", "Erreur : " + e.getMessage());
        }
    }

    /**
     * RAG multimodal : image → description LLM vision → embed → pgVector.
     * Utilise l'API ChatClient.prompt().user(u -> u.text().media()) de Spring AI 1.0.0.
     */
    public IngestResponse ingestImage(MultipartFile file) {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image";
        log.info("Indexing image via vision ({}): {}", visionModel, filename);
        try {
            byte[]   bytes = file.getBytes();
            MimeType mt    = MimeType.valueOf(file.getContentType() != null ? file.getContentType() : "image/jpeg");

            // Vision call via ChatClient API — gère Media en interne, pas d'import direct
            String description = visionClient.prompt()
                    .user(u -> u.text(VISION_PROMPT).media(mt, new ByteArrayResource(bytes)))
                    .options(OpenAiChatOptions.builder().model(visionModel).build())
                    .call()
                    .content();

            if (description == null || description.isBlank())
                return new IngestResponse(filename, 0, "error", "Aucune description retournée par le modèle vision");

            Document doc = new Document(description, Map.of(
                    "filename", filename, "fileType", "image",
                    "contentType", "image_vision_description",
                    "visionModel", visionModel,
                    "ingestedAt", Instant.now().toString()));

            TokenTextSplitter splitter = new TokenTextSplitter(CHUNK_SIZE, CHUNK_OVERLAP, 5, 10000, true);
            List<Document> chunks = splitter.apply(List.of(doc));
            vectorStore.add(chunks);

            String preview = description.length() > 150 ? description.substring(0, 150) + "…" : description;
            log.info("Image indexed: {} -> {} chunk(s)", filename, chunks.size());
            return new IngestResponse(filename, chunks.size(), "success", "🖼️ Vision IA : " + preview);

        } catch (Exception e) {
            log.error("Error indexing image {}: {}", filename, e.getMessage(), e);
            return new IngestResponse(filename, 0, "error", "Erreur vision : " + e.getMessage());
        }
    }

    public void deleteAll() {
        jdbcTemplate.execute("DELETE FROM vector_store");
    }

    public void deleteByFilename(String filename) {
        int rows = jdbcTemplate.update(
                "DELETE FROM vector_store WHERE metadata::jsonb->>'filename' = ?", filename);
        log.info("Deleted {} chunk(s) for: {}", rows, filename);
    }

    public List<Map<String, Object>> listDocuments() {
        try {
            return jdbcTemplate.queryForList(
                    "SELECT metadata::jsonb->>'filename' AS filename, COUNT(*) AS chunks " +
                    "FROM vector_store WHERE metadata IS NOT NULL " +
                    "GROUP BY metadata::jsonb->>'filename' ORDER BY filename");
        } catch (Exception e) {
            log.warn("Could not list documents: {}", e.getMessage());
            return List.of();
        }
    }

    public long countDocuments() {
        try {
            Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vector_store", Long.class);
            return count != null ? count : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }
}
