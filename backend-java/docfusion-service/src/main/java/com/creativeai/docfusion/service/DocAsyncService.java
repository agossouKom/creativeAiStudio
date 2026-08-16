package com.creativeai.docfusion.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.docfusion.model.DocJob;
import com.creativeai.docfusion.repository.DocJobRepository;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocAsyncService {

    private final PdfProcessingService   pdf;
    private final MinioClient            minio;
    private final StringRedisTemplate    redis;
    private final SimpMessagingTemplate  ws;
    private final DocJobRepository       jobRepo;
    private final ObjectMapper           mapper = new ObjectMapper();

    @Value("${app.gateway-url:http://localhost:8480}")
    private String gatewayUrl;

    @Value("${minio.result-bucket:docfusion-results}")
    private String resultBucket;

    @PostConstruct
    public void init() {
        try {
            boolean exists = minio.bucketExists(
                    io.minio.BucketExistsArgs.builder().bucket(resultBucket).build());
            if (!exists) {
                minio.makeBucket(io.minio.MakeBucketArgs.builder().bucket(resultBucket).build());
                log.info("[MinIO] Bucket '{}' cree.", resultBucket);
            }
        } catch (Exception e) {
            log.error("[MinIO] Init bucket: {}", e.getMessage());
        }
    }

    // ─── Merge PDF ────────────────────────────────────────────────────────────

    @Async
    public void processMerge(List<byte[]> filesData, List<String> fileNames, String jobId) {
        try {
            log.info("[MERGE] Job {} — {} fichiers", jobId, filesData.size());
            byte[] result    = pdf.mergeBytes(filesData, fileNames);
            String resultUrl = uploadResult(jobId, "merged.pdf", result, "application/pdf");
            complete(jobId, "MERGE", resultUrl, "merged.pdf", null);
        } catch (Exception e) {
            log.error("[MERGE] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "MERGE", e.getMessage());
        }
    }

    // ─── Merge DOCX ──────────────────────────────────────────────────────────

    @Async
    public void processMergeDocx(List<byte[]> filesData, List<String> fileNames, String jobId) {
        try {
            log.info("[MERGE_DOCX] Job {} — {} fichiers", jobId, filesData.size());
            byte[] result    = pdf.mergeToDocx(filesData, fileNames);
            String ct        = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            String resultUrl = uploadResult(jobId, "merged.docx", result, ct);
            complete(jobId, "MERGE_DOCX", resultUrl, "merged.docx", null);
        } catch (Exception e) {
            log.error("[MERGE_DOCX] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "MERGE_DOCX", e.getMessage());
        }
    }

    // ─── Split ────────────────────────────────────────────────────────────────

    @Async
    public void processSplit(byte[] fileData, int start, int end, String jobId) {
        try {
            log.info("[SPLIT] Job {} — pages {}-{}", jobId, start, end);
            byte[] result    = pdf.split(fileData, start, end);
            String name      = "split_" + start + "_" + end + ".pdf";
            String resultUrl = uploadResult(jobId, name, result, "application/pdf");
            complete(jobId, "SPLIT", resultUrl, name, null);
        } catch (Exception e) {
            log.error("[SPLIT] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "SPLIT", e.getMessage());
        }
    }

    // ─── Compress ─────────────────────────────────────────────────────────────

    @Async
    public void processCompress(byte[] fileData, String outputFormat, String originalName, String jobId) {
        try {
            log.info("[COMPRESS] Job {} — format: {}", jobId, outputFormat);
            byte[] result = pdf.compress(fileData, outputFormat, originalName);
            boolean isZip = "zip".equalsIgnoreCase(outputFormat);
            String resName = isZip ? "compressed.zip" : "compressed.pdf";
            String ct      = isZip ? "application/zip" : "application/pdf";
            String resultUrl = uploadResult(jobId, resName, result, ct);
            complete(jobId, "COMPRESS", resultUrl, resName, null);
        } catch (Exception e) {
            log.error("[COMPRESS] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "COMPRESS", e.getMessage());
        }
    }

    // ─── Watermark ────────────────────────────────────────────────────────────

    @Async
    public void processWatermark(byte[] fileData, String text, float rotation, String color, String jobId) {
        try {
            log.info("[WATERMARK] Job {} — texte: '{}' rotation: {}deg couleur: {}", jobId, text, rotation, color);
            byte[] result    = pdf.watermark(fileData, text, rotation, color);
            String resultUrl = uploadResult(jobId, "watermarked.pdf", result, "application/pdf");
            complete(jobId, "WATERMARK", resultUrl, "watermarked.pdf", null);
        } catch (Exception e) {
            log.error("[WATERMARK] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "WATERMARK", e.getMessage());
        }
    }

    // ─── Conversion To PDF ────────────────────────────────────────────────────

    @Async
    public void processToPdf(byte[] fileData, String filename, String jobId) {
        try {
            log.info("[TO_PDF] Job {} — fichier: {}", jobId, filename);
            byte[] result    = pdf.toPdf(fileData, filename);
            String resultUrl = uploadResult(jobId, "converted.pdf", result, "application/pdf");
            complete(jobId, "TO_PDF", resultUrl, "converted.pdf", null);
        } catch (Exception e) {
            log.error("[TO_PDF] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "TO_PDF", e.getMessage());
        }
    }

    // ─── Conversion To DOCX ──────────────────────────────────────────────────

    @Async
    public void processToDocx(byte[] fileData, String jobId) {
        try {
            log.info("[TO_DOCX] Job {}", jobId);
            byte[] result = pdf.pdfToDocx(fileData);
            String ct     = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            String resultUrl = uploadResult(jobId, "converted.docx", result, ct);
            complete(jobId, "TO_DOCX", resultUrl, "converted.docx", null);
        } catch (Exception e) {
            log.error("[TO_DOCX] Job {} echec: {}", jobId, e.getMessage());
            fail(jobId, "TO_DOCX", e.getMessage());
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private String uploadResult(String jobId, String filename, byte[] data, String contentType) throws Exception {
        String key = "results/" + jobId + "/" + filename;
        minio.putObject(PutObjectArgs.builder()
                .bucket(resultBucket)
                .object(key)
                .stream(new ByteArrayInputStream(data), data.length, -1)
                .contentType(contentType)
                .build());
        return gatewayUrl + "/api/docfusion/jobs/" + jobId + "/download";
    }

    private void complete(String jobId, String op, String resultUrl, String fileName, String text) {
        try {
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("jobId",         jobId);
            payload.put("status",        "DONE");
            payload.put("operationType", op);
            payload.put("resultUrl",     resultUrl);
            payload.put("fileName",      fileName);

            String json = mapper.writeValueAsString(payload);
            redis.opsForValue().set("docfusion:result:" + jobId, json, Duration.ofHours(1));

            jobRepo.findByJobId(jobId).ifPresent(job -> {
                job.setStatus("DONE");
                job.setCompletedAt(LocalDateTime.now());
                job.setResultUrl(resultUrl);
                if (text != null) job.setResultText(text);
                jobRepo.save(job);
            });

            ws.convertAndSend("/topic/docfusion/" + jobId,
                    Map.of("jobId", jobId, "status", "DONE", "result", payload));

            log.info("[JOB] {} ({}) termine -> {}", jobId, op, fileName);
        } catch (Exception e) {
            log.error("[JOB] Erreur finalisation {}: {}", jobId, e.getMessage());
        }
    }

    private void fail(String jobId, String op, String errorMsg) {
        try {
            Map<String, Object> payload = Map.of(
                    "jobId",         jobId,
                    "status",        "FAILED",
                    "operationType", op,
                    "error",         errorMsg != null ? errorMsg : "Erreur inconnue"
            );
            String json = mapper.writeValueAsString(payload);
            redis.opsForValue().set("docfusion:result:" + jobId, json, Duration.ofHours(1));

            jobRepo.findByJobId(jobId).ifPresent(job -> {
                job.setStatus("FAILED");
                job.setCompletedAt(LocalDateTime.now());
                job.setErrorMsg(errorMsg);
                jobRepo.save(job);
            });

            ws.convertAndSend("/topic/docfusion/" + jobId,
                    Map.of("jobId", jobId, "status", "FAILED", "result", payload));
        } catch (Exception e) {
            log.error("[JOB] Erreur echec {}: {}", jobId, e.getMessage());
        }
    }

    public String createJob(String userEmail, String operation, String fileName) {
        String jobId = UUID.randomUUID().toString();
        DocJob job = DocJob.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .operation(operation)
                .status("PROCESSING")
                .fileName(fileName)
                .createdAt(LocalDateTime.now())
                .build();
        jobRepo.save(job);
        redis.opsForValue().set("docfusion:job:" + jobId, "PROCESSING", Duration.ofMinutes(30));
        return jobId;
    }
}
