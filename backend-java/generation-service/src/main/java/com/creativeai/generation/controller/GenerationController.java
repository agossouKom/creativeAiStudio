package com.creativeai.generation.controller;

import com.creativeai.generation.dto.CreateImageRequest;
import com.creativeai.generation.dto.CreateVideoRequest;
import com.creativeai.generation.dto.GenerationJobResponse;
import com.creativeai.generation.dto.GenerationOutputResponse;
import com.creativeai.generation.dto.PageResponse;
import com.creativeai.generation.service.GenerationService;
import com.creativeai.generation.service.MediaStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/generation")
@RequiredArgsConstructor
@Tag(name = "Génération média", description = "Générations vidéo et image orchestrées via Kafka")
public class GenerationController {

    private final GenerationService generationService;

    @PostMapping("/video")
    @Operation(summary = "Lance une génération vidéo (pipeline local FFmpeg)")
    public ResponseEntity<GenerationJobResponse> createVideo(@Valid @RequestBody CreateVideoRequest request,
                                                            Authentication authentication,
                                                            @RequestHeader(HttpHeaders.AUTHORIZATION) String callerToken) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(generationService.createVideo(request, user(authentication), callerToken));
    }

    @PostMapping("/image")
    @Operation(summary = "Lance une génération d'images (worker compatible OpenAI)")
    public ResponseEntity<GenerationJobResponse> createImage(@Valid @RequestBody CreateImageRequest request,
                                                            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(generationService.createImage(request, user(authentication)));
    }

    @GetMapping("/jobs")
    @Operation(summary = "Liste les générations de l'utilisateur")
    public PageResponse<GenerationJobResponse> list(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size,
                                                   Authentication authentication) {
        return generationService.list(user(authentication), page, size);
    }

    @GetMapping("/jobs/{jobId}")
    @Operation(summary = "Détail d'une génération, avec ses sorties stockées")
    public GenerationJobResponse get(@PathVariable String jobId, Authentication authentication) {
        return generationService.get(jobId, user(authentication));
    }

    @PostMapping("/jobs/{jobId}/retry")
    @Operation(summary = "Relance un job terminé ou échoué (incrémente executionVersion)")
    public ResponseEntity<GenerationJobResponse> retry(@PathVariable String jobId,
                                                       Authentication authentication,
                                                       @RequestHeader(HttpHeaders.AUTHORIZATION) String callerToken) {
        return ResponseEntity.accepted()
            .body(generationService.retry(jobId, user(authentication), callerToken));
    }

    @GetMapping("/jobs/{jobId}/outputs")
    @Operation(summary = "Références MinIO des sorties du job")
    public List<GenerationOutputResponse> outputs(@PathVariable String jobId, Authentication authentication) {
        return generationService.outputs(jobId, user(authentication));
    }

    @GetMapping("/jobs/{jobId}/outputs/{index}/download-url")
    @Operation(summary = "URL signée de téléchargement, valable 2 h par défaut")
    public Map<String, Object> downloadUrl(@PathVariable String jobId,
                                           @PathVariable int index,
                                           Authentication authentication) {
        MediaStorageService.PresignedDownload download =
            generationService.downloadUrl(jobId, index, user(authentication));
        return Map.of(
            "url", download.url(),
            "contentType", download.contentType(),
            "sizeBytes", download.sizeBytes(),
            "expiresAt", download.expiresAt().toString());
    }

    private String user(Authentication authentication) {
        return authentication != null ? authentication.getName() : "anonymous";
    }
}
