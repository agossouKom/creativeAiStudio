package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.service.MinioService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * MediaController — Point d'entrée pour les uploads de fichiers.
 *
 * Chaque fichier passe par le file-security-service :
 *  1. Vérification Magic Bytes
 *  2. Détection de scripts/injections
 *  3. Antivirus / VirusTotal
 *  4. Assainissement / Re-encodage (pour les images)
 *  5. Stockage MinIO si sain, rejet 400 sinon
 *
 * Politique : FAIL-CLOSED. Si le scanner est injoignable, si sa réponse n'est pas
 * exploitable, ou si elle est illisible, l'upload est REFUSÉ (503) et rien
 * n'est écrit dans MinIO. Un mode dégradé « fail-open » laisserait passer dans
 * MinIO n'importe quel fichier uniquement en arrêtant le conteneur scanner — un
 * déni de service de un clic suffirait à contourner toute la chaîne de sécurité.
 *
 * L'authentification est imposée par SecurityConfig (`anyRequest().authenticated()`)
 * : `/api/media/**` n'est plus en permitAll.
 */
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
@Slf4j
public class MediaController {

    /** Dossier d'un seul niveau : alphanumériques, tiret, underscore. */
    private static final Pattern SAFE_FOLDER = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");

    private static final Duration SCAN_CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration SCAN_READ_TIMEOUT    = Duration.ofSeconds(20);

    private final MinioService minioService;
    private final ObjectMapper objectMapper;

    @Value("${file-security.url:http://file-security-service:8090}")
    private String fileSecurityUrl;

    private final RestTemplate restTemplate = buildRestTemplate();

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(SCAN_CONNECT_TIMEOUT);
        factory.setReadTimeout(SCAN_READ_TIMEOUT);
        return new RestTemplate(factory);
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> upload(
            @AuthenticationPrincipal String userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "uploads") String folder) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fichier vide"));
        }

        // Le `folder` vient du client et est concaténé dans la clé d'objet MinIO
        // ("products/" + folder + "/" + uuid) : sans cette validation, un
        // `../../` permet d'écrire hors du préfixe products/.
        if (folder == null || !SAFE_FOLDER.matcher(folder).matches()) {
            log.warn("[MEDIA_UPLOAD] Dossier refusé : {}", folder);
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Dossier invalide (lettres, chiffres, '-' et '_' uniquement, 64 caractères max)"));
        }

        // ── 1. Vérification auprès du file-security-service (fail-closed) ──────
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

            if (scanResp.getStatusCode() != HttpStatus.OK || scanResp.getBody() == null) {
                log.error("[MEDIA_UPLOAD] Scan non exploitable ({}), upload refusé", scanResp.getStatusCode());
                return scannerUnavailable();
            }

            JsonNode result;
            try {
                result = objectMapper.readTree(scanResp.getBody());
            } catch (Exception parseError) {
                log.error("[MEDIA_UPLOAD] Réponse du scanner illisible, upload refusé : {}", parseError.getMessage());
                return scannerUnavailable();
            }

            // `safe` absent = verdict inconnu = refus. Ne jamais le lire avec un
            // défaut `true` : un champ manquant valait « fichier sain » jusqu'ici.
            if (!result.has("safe")) {
                log.error("[MEDIA_UPLOAD] Réponse du scanner sans verdict 'safe', upload refusé : {}", result);
                return scannerUnavailable();
            }

            boolean safe = result.path("safe").asBoolean(false);
            if (!safe) {
                JsonNode reasons = result.path("reasons");
                String reasonStr = reasons.isArray() && reasons.size() > 0
                    ? reasons.get(0).asText()
                    : "Fichier rejeté par la politique de sécurité";
                log.warn("[MEDIA_UPLOAD] Fichier {} rejeté (user={}) : {}",
                    file.getOriginalFilename(), userId, reasonStr);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Sécurité : " + reasonStr,
                    "safe", false,
                    "details", reasons
                ));
            }

        } catch (HttpStatusCodeException e) {
            // Le scanner a tranché sur le fichier lui-même (413 trop volumineux,
            // 400 image corrompue, 415 format refusé). C'est une erreur de requête,
            // pas une panne : la déguiser en 503 ferait dire à l'utilisateur
            // « réessayez plus tard » alors que son fichier ne passera jamais.
            if (e.getStatusCode().is4xxClientError()) {
                log.warn("[MEDIA_UPLOAD] Scanner a refusé {} (user={}) : {} {}",
                    file.getOriginalFilename(), userId, e.getStatusCode(), e.getResponseBodyAsString());
                return ResponseEntity.status(e.getStatusCode()).body(Map.of(
                    "error", scannerDetail(e),
                    "safe", false,
                    "details", e.getResponseBodyAsString()
                ));
            }
            log.error("[MEDIA_UPLOAD] Scanner en erreur {} (user={}), upload REFUSÉ (fail-closed)",
                e.getStatusCode(), userId);
            return scannerUnavailable();
        } catch (RestClientException e) {
            log.error("[MEDIA_UPLOAD] file-security-service injoignable ({}), upload REFUSÉ (fail-closed)",
                e.getMessage());
            return scannerUnavailable();
        } catch (Exception e) {
            log.error("[MEDIA_UPLOAD] Erreur pendant le scan ({}), upload REFUSÉ (fail-closed)", e.getMessage());
            return scannerUnavailable();
        }

        // ── 2. Stockage MinIO ─────────────────────────────────────────────────
        try {
            String url = minioService.uploadProductMedia(file, folder);
            log.info("[MEDIA_UPLOAD] Fichier sain stocké (user={}) : {} → {}",
                userId, file.getOriginalFilename(), url);
            return ResponseEntity.ok(Map.of(
                "url", url,
                "fileName", file.getOriginalFilename(),
                "safe", true
            ));
        } catch (Exception e) {
            log.error("[MEDIA_UPLOAD] Stockage MinIO refusé ({}), fichier {}", e.getMessage(), file.getOriginalFilename());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Fichier refusé : " + e.getMessage(), "safe", false));
        }
    }

    /** 503 + `Retry-After` : le client doit réessayer, pas contourner. */
    private ResponseEntity<Map<String, Object>> scannerUnavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .header(HttpHeaders.RETRY_AFTER, "30")
            .body(Map.of(
                "error", "Service de vérification de sécurité indisponible, upload refusé. Réessayez dans un instant.",
                "safe", false,
                "scanner", "indisponible"
            ));
    }

    /** Extrait le `detail` d'une réponse d'erreur FastAPI, sans recopier le corps brut. */
    private String scannerDetail(HttpStatusCodeException e) {
        try {
            JsonNode body = objectMapper.readTree(e.getResponseBodyAsString());
            String detail = body.path("detail").asText(null);
            if (detail != null && !detail.isBlank()) {
                return detail;
            }
        } catch (Exception ignored) {
            // corps non JSON : on retombe sur le message générique
        }
        return "Fichier refusé par la politique de sécurité";
    }
}
