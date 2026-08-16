package com.creativeai.auth.controller;

import com.creativeai.auth.service.MediaVerificationService;
import com.creativeai.auth.service.MediaVerificationService.VerificationResult;
import com.creativeai.auth.service.MinioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UploadController {

    private final MinioService minioService;
    private final MediaVerificationService verifier;

    /**
     * POST /api/media/upload  — upload sécurisé pour les médias produits (photos/vidéos).
     * Accessible à tout utilisateur authentifié. Vérifie magic bytes, scripts et EXIF.
     */
    @PostMapping(value = "/api/media/upload", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "photos") String folder) {

        VerificationResult result = verifier.verify(file, folder);
        if (!result.safe()) {
            log.warn("[UPLOAD] Fichier refusé '{}' : {}", file.getOriginalFilename(), result.reason());
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", result.reason()));
        }

        try {
            String ext = extension(file.getOriginalFilename());
            String url;
            if ("photos".equals(folder)) {
                // Re-encode image to strip EXIF and hidden payloads
                byte[] clean = verifier.sanitizeImage(file.getBytes(), ext);
                String ct = "png".equals(ext) ? "image/png" : "image/jpeg";
                url = minioService.uploadBytes(clean, file.getOriginalFilename(), ct, folder);
            } else {
                url = minioService.upload(file, folder);
            }
            log.info("[UPLOAD] Fichier accepté et stocké : {}", url);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            log.error("[UPLOAD] Erreur stockage MinIO: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors du stockage du fichier"));
        }
    }

    /** POST /api/upload/pub-images — images campagnes pub (ADMIN) */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/api/upload/pub-images", consumes = "multipart/form-data")
    public ResponseEntity<List<String>> uploadPubImages(
            @RequestParam("files") List<MultipartFile> files) {
        List<String> urls = minioService.uploadAll(files, "pubs");
        return ResponseEntity.ok(urls);
    }

    /** POST /api/upload/single — upload générique (ADMIN) */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/api/upload/single", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadSingle(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "misc") String folder) {
        String url = minioService.upload(file, folder);
        return ResponseEntity.ok(Map.of("url", url));
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

}
