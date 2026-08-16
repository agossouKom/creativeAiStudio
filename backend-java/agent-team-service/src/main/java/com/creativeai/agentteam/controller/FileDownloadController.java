package com.creativeai.agentteam.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Sert les fichiers générés (.docx) depuis le répertoire local d'upload.
 */
@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileDownloadController {

    @Value("${agent.upload-dir:./uploads}")
    private String uploadDir;

    @GetMapping("/{fileName}")
    public ResponseEntity<Resource> download(@PathVariable String fileName) {
        // Sécurité : interdire traversée de répertoire
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }

        Path filePath = Paths.get(uploadDir).resolve(fileName).normalize();
        Resource resource = new FileSystemResource(filePath);

        if (!resource.exists()) {
            log.warn("[FILES] Fichier introuvable: {}", fileName);
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = fileName.endsWith(".docx")
            ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            : MediaType.APPLICATION_OCTET_STREAM;

        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
            .body(resource);
    }
}
