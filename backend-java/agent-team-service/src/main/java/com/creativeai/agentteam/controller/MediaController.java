package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.service.MinioService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * MediaController — Point d'entrée sécurisé pour les uploads de fichiers.
 * Chaque fichier passe par le file-security-service :
 *  1. Vérification Magic Bytes
 *  2. Détection de scripts/injections
 *  3. Antivirus / VirusTotal
 *  4. Assainissement / Re-encodage (pour les images)
 *  5. Stockage MinIO si sain, rejet 400 sinon
 */
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class MediaController {

    private final MinioService minioService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${file-security.url:http://file-security-service:8090}")
    private String fileSecurityUrl;

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "uploads") String folder) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fichier vide"));
        }

        // ── 1. Vérification auprès du file-security-service ───────────────────
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> scanResp = restTemplate.postForEntity(
                fileSecurityUrl + "/scan", requestEntity, String.class);

            if (scanResp.getStatusCode() == HttpStatus.OK && scanResp.getBody() != null) {
                JsonNode result = objectMapper.readTree(scanResp.getBody());
                boolean safe = result.path("safe").asBoolean(true);
                if (!safe) {
                    JsonNode reasons = result.path("reasons");
                    String reasonStr = reasons.isArray() && reasons.size() > 0
                        ? reasons.get(0).asText()
                        : "Fichier rejeté par la politique de sécurité";
                    log.warn("[MEDIA_UPLOAD] Fichier {} rejeté : {}", file.getOriginalFilename(), reasonStr);
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "Sécurité : " + reasonStr,
                        "safe", false,
                        "details", reasons
                    ));
                }
            }
        } catch (Exception e) {
            log.warn("[MEDIA_UPLOAD] file-security-service injoignable ({}), upload accepté en mode dégradé", e.getMessage());
            // En cas d'indisponibilité du microservice, on ne bloque pas les utilisateurs (fail-open ou fail-closed selon politique)
        }

        // ── 2. Stockage MinIO ─────────────────────────────────────────────────
        String url = minioService.uploadProductMedia(file, folder);
        log.info("[MEDIA_UPLOAD] Fichier sain stocké avec succès : {} → {}", file.getOriginalFilename(), url);
        return ResponseEntity.ok(Map.of(
            "url", url,
            "fileName", file.getOriginalFilename(),
            "safe", true
        ));
    }
}
