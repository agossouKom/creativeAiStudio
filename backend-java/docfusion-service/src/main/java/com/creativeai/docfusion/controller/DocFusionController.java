package com.creativeai.docfusion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.docfusion.messaging.DocJobProducer;
import com.creativeai.docfusion.model.DocJob;
import com.creativeai.docfusion.repository.DocJobRepository;
import com.creativeai.docfusion.service.DocAsyncService;
import com.creativeai.docfusion.service.PdfProcessingService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/docfusion")
@RequiredArgsConstructor
public class DocFusionController {

    private final DocAsyncService      asyncService;
    private final DocJobProducer       producer;
    private final DocJobRepository     jobRepo;
    private final StringRedisTemplate  redis;
    private final MinioClient          minio;
    private final PdfProcessingService pdf;
    private final ObjectMapper         mapper = new ObjectMapper();

    @Value("${minio.result-bucket:docfusion-results}")
    private String resultBucket;

    // ─── PDF Operations ──────────────────────────────────────────────────────

    @PostMapping("/pdf/merge")
    public ResponseEntity<Map<String, String>> merge(
            @RequestParam List<MultipartFile> files,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        if (files == null || files.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Au moins 2 fichiers requis"));
        }
        List<byte[]> filesData = new java.util.ArrayList<>();
        List<String> fileNames = new java.util.ArrayList<>();
        for (MultipartFile f : files) {
            filesData.add(f.getBytes());
            fileNames.add(f.getOriginalFilename() != null ? f.getOriginalFilename() : "file");
        }
        String jobId = asyncService.createJob(userEmail, "MERGE", fileNames.get(0));
        asyncService.processMerge(filesData, fileNames, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @PostMapping("/pdf/split")
    public ResponseEntity<Map<String, String>> split(
            @RequestParam MultipartFile file,
            @RequestParam int start,
            @RequestParam int end,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        byte[] data  = file.getBytes();
        String jobId = asyncService.createJob(userEmail, "SPLIT", file.getOriginalFilename());
        asyncService.processSplit(data, start, end, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @PostMapping("/pdf/compress")
    public ResponseEntity<Map<String, String>> compress(
            @RequestParam MultipartFile file,
            @RequestParam(defaultValue = "zip") String outputFormat,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        byte[] data     = file.getBytes();
        String origName = file.getOriginalFilename();
        String jobId    = asyncService.createJob(userEmail, "COMPRESS", origName);
        asyncService.processCompress(data, outputFormat, origName, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @PostMapping("/pdf/watermark")
    public ResponseEntity<Map<String, String>> watermark(
            @RequestParam MultipartFile file,
            @RequestParam(defaultValue = "CONFIDENTIEL") String text,
            @RequestParam(defaultValue = "45") float rotation,
            @RequestParam(defaultValue = "#808080") String color,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        byte[] data  = file.getBytes();
        String jobId = asyncService.createJob(userEmail, "WATERMARK", file.getOriginalFilename());
        asyncService.processWatermark(data, text, rotation, color, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    // ─── Conversion ──────────────────────────────────────────────────────────

    @PostMapping("/convert/to-pdf")
    public ResponseEntity<Map<String, String>> toPdf(
            @RequestParam MultipartFile file,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        byte[] data  = file.getBytes();
        String jobId = asyncService.createJob(userEmail, "TO_PDF", file.getOriginalFilename());
        asyncService.processToPdf(data, file.getOriginalFilename(), jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @PostMapping("/convert/to-docx")
    public ResponseEntity<Map<String, String>> toDocx(
            @RequestParam MultipartFile file,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        byte[] data  = file.getBytes();
        String jobId = asyncService.createJob(userEmail, "TO_DOCX", file.getOriginalFilename());
        asyncService.processToDocx(data, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @PostMapping("/pdf/merge-docx")
    public ResponseEntity<Map<String, String>> mergeToDocx(
            @RequestParam List<MultipartFile> files,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        if (files == null || files.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Au moins 2 fichiers requis"));
        }
        List<byte[]> filesData = new java.util.ArrayList<>();
        List<String> fileNames = new java.util.ArrayList<>();
        for (MultipartFile f : files) {
            filesData.add(f.getBytes());
            fileNames.add(f.getOriginalFilename() != null ? f.getOriginalFilename() : "file");
        }
        String jobId = asyncService.createJob(userEmail, "MERGE_DOCX", fileNames.get(0));
        asyncService.processMergeDocx(filesData, fileNames, jobId);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    // ─── Base64 ───────────────────────────────────────────────────────────────

    /** Encode un fichier en Base64 — reponse immediate (pas de job asynchrone) */
    @PostMapping("/convert/base64/encode")
    public ResponseEntity<Map<String, Object>> base64Encode(
            @RequestParam MultipartFile file) throws Exception {

        byte[] data     = file.getBytes();
        String b64      = pdf.encodeBase64(data);
        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        return ResponseEntity.ok(Map.of(
                "base64",        b64,
                "originalName",  origName,
                "sizeBytes",     data.length,
                "base64Length",  b64.length()
        ));
    }

    /** Decode du Base64 et retourne le fichier binaire en download direct.
     *  Accepte : Base64 brut OU prefixe Data URL (data:...;base64,XXXX) */
    @PostMapping("/convert/base64/decode")
    public ResponseEntity<?> base64Decode(
            @RequestParam String base64Data,
            @RequestParam(defaultValue = "decoded_file.bin") String filename) {
        try {
            if (base64Data == null || base64Data.isBlank()) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("error", "Donnees Base64 manquantes ou vides"));
            }
            byte[] decoded = pdf.decodeBase64(base64Data);
            if (decoded.length == 0) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("error", "Le decodage a produit un fichier vide — verifiez que la chaine Base64 est complete"));
            }
            String ct = guessContentType(filename);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(ct))
                    .body(decoded);
        } catch (IllegalArgumentException e) {
            log.warn("[BASE64_DECODE] Donnees invalides: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("error", "Format Base64 invalide : " + e.getMessage()
                            + ". Assurez-vous de coller uniquement la chaine Base64 (sans prefixe data:...)."));
        } catch (Exception e) {
            log.error("[BASE64_DECODE] Erreur inattendue: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("error", "Erreur serveur lors du decodage : " + e.getMessage()));
        }
    }

    // ─── OCR (Kafka → Python) ─────────────────────────────────────────────────

    @PostMapping("/ocr")
    public ResponseEntity<Map<String, String>> ocr(
            @RequestParam MultipartFile file,
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) throws Exception {

        String jobId = producer.dispatchOcrJob(file, userEmail);
        DocJob job = DocJob.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .operation("OCR")
                .status("PROCESSING")
                .fileName(file.getOriginalFilename())
                .createdAt(java.time.LocalDateTime.now())
                .build();
        jobRepo.save(job);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    // ─── Job Status ───────────────────────────────────────────────────────────

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Object> getJob(@PathVariable String jobId) throws Exception {
        String cached = redis.opsForValue().get("docfusion:result:" + jobId);
        if (cached != null) {
            return ResponseEntity.ok(mapper.readValue(cached, Map.class));
        }
        return jobRepo.findByJobId(jobId)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/jobs")
    public ResponseEntity<List<DocJob>> getUserJobs(
            @RequestHeader(value = "X-User-Email", defaultValue = "anonymous") String userEmail) {
        return ResponseEntity.ok(jobRepo.findByUserEmailOrderByCreatedAtDesc(userEmail));
    }

    // ─── Telechargement proxy (pas d'exposition directe de MinIO) ────────────

    @GetMapping("/jobs/{jobId}/download")
    public ResponseEntity<StreamingResponseBody> download(@PathVariable String jobId) throws Exception {
        String cached = redis.opsForValue().get("docfusion:result:" + jobId);
        if (cached == null) return ResponseEntity.notFound().build();

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = mapper.readValue(cached, Map.class);
        if (!"DONE".equals(payload.get("status"))) return ResponseEntity.notFound().build();

        String resultFileName = (String) payload.get("fileName");
        String key = "results/" + jobId + "/" + resultFileName;

        var stat = minio.statObject(StatObjectArgs.builder()
                .bucket(resultBucket).object(key).build());

        StreamingResponseBody body = out -> {
            try (var stream = minio.getObject(GetObjectArgs.builder()
                    .bucket(resultBucket).object(key).build())) {
                stream.transferTo(out);
            } catch (Exception e) {
                throw new java.io.IOException("Erreur lecture MinIO: " + e.getMessage(), e);
            }
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resultFileName + "\"")
                .contentType(MediaType.parseMediaType(stat.contentType()))
                .body(body);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private String guessContentType(String filename) {
        if (filename == null) return "application/octet-stream";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf"))  return "application/pdf";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".png"))  return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".txt"))  return "text/plain";
        if (lower.endsWith(".zip"))  return "application/zip";
        return "application/octet-stream";
    }
}
