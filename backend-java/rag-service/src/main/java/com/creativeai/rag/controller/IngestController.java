package com.creativeai.rag.controller;

import com.creativeai.rag.model.IngestResponse;
import com.creativeai.rag.service.IngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/rag")
@RequiredArgsConstructor
public class IngestController {

    private final IngestionService ingestionService;

    private static final List<String> IMAGE_EXTENSIONS =
            List.of("jpg","jpeg","png","gif","bmp","webp","tiff","heic","avif");

    @PostMapping(value = "/ingest", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<IngestResponse>> ingest(
            @RequestParam("files") List<MultipartFile> files) {

        log.info("Ingest request: {} file(s)", files.size());
        List<IngestResponse> results = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file.isEmpty()) {
                results.add(new IngestResponse(file.getOriginalFilename(), 0, "error", "Fichier vide ignoré"));
                continue;
            }
            String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
            String ext  = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : "";
            // Images → pipeline vision LLM (multimodal RAG)
            if (IMAGE_EXTENSIONS.contains(ext)) {
                results.add(ingestionService.ingestImage(file));
            } else {
                results.add(ingestionService.ingest(file));
            }
        }

        return ResponseEntity.ok(results);
    }

    /** GET /rag/documents — Liste les fichiers indexés avec leur nombre de chunks. */
    @GetMapping("/documents")
    public ResponseEntity<List<Map<String, Object>>> listDocuments() {
        return ResponseEntity.ok(ingestionService.listDocuments());
    }

    /** DELETE /rag/documents?filename=xxx — Supprime un fichier spécifique (ou tous si pas de param). */
    @DeleteMapping("/documents")
    public ResponseEntity<Map<String, String>> deleteDocuments(
            @RequestParam(required = false) String filename) {
        if (filename != null && !filename.isBlank()) {
            log.info("Delete document: {}", filename);
            ingestionService.deleteByFilename(filename);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Document supprimé : " + filename));
        }
        log.warn("Delete ALL documents");
        ingestionService.deleteAll();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Tous les documents supprimés"));
    }

    /** GET /rag/documents/count — Nombre total de chunks indexés. */
    @GetMapping("/documents/count")
    public ResponseEntity<Map<String, Long>> getDocumentCount() {
        return ResponseEntity.ok(Map.of("count", ingestionService.countDocuments()));
    }
}
