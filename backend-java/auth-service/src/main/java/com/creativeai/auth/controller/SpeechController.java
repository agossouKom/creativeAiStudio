package com.creativeai.auth.controller;

import com.creativeai.auth.model.UserApiCredential;
import com.creativeai.auth.repository.UserApiCredentialRepository;
import com.creativeai.auth.security.EncryptionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class SpeechController {

    private final UserApiCredentialRepository credentialRepo;
    private final EncryptionService            encryptionService;
    private final WebClient.Builder            webClientBuilder;
    private final ObjectMapper                 objectMapper;

    @Value("${agent.groq-base-url}")
    private String groqBaseUrl;

    @PostMapping(value = "/api/speech/transcribe", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> transcribe(
            @RequestParam("file") MultipartFile audio) {

        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        String apiKey = resolveApiKey(userId);

        try {
            byte[] bytes = audio.getBytes();
            String filename = audio.getOriginalFilename() != null ? audio.getOriginalFilename() : "audio.webm";

            // Strip codec params (e.g. "audio/ogg;codecs=opus" → "audio/ogg") — Groq rejects params
            String rawCt = audio.getContentType() != null ? audio.getContentType() : "audio/webm";
            String groqCt = rawCt.split(";")[0].trim();

            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", new ByteArrayResource(bytes) {
                @Override public String getFilename() { return filename; }
            }).contentType(MediaType.parseMediaType(groqCt));
            builder.part("model", "whisper-large-v3");
            builder.part("language", "fr");
            builder.part("response_format", "json");

            String response = webClientBuilder.build()
                    .post()
                    .uri(groqBaseUrl + "/audio/transcriptions")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode node = objectMapper.readTree(response);
            String text = node.path("text").asText("");
            log.info("[STT] user={} chars={}", userId, text.length());
            return ResponseEntity.ok(Map.of("text", text));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(402).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[STT] Erreur transcription: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Erreur transcription : " + e.getMessage()));
        }
    }

    private String resolveApiKey(String userId) {
        return credentialRepo.findByUserIdAndProviderAndActiveTrue(userId, "groq")
                .map(c -> encryptionService.decrypt(c.getEncryptedApiKey()))
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune clé Groq configurée. Allez dans Paramètres > Clés API."));
    }
}
