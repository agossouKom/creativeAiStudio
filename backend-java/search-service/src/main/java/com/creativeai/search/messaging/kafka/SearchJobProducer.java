package com.creativeai.search.messaging.kafka;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchJobProducer {

    private final KafkaTemplate<String, SearchJobEvent> kafkaTemplate;
    private final MinioClient                           minioClient;

    @Value("${minio.bucket:creativeai-uploads}")
    private String bucket;

    @jakarta.annotation.PostConstruct
    public void init() {
        try {
            boolean exists = minioClient.bucketExists(
                    io.minio.BucketExistsArgs.builder().bucket(bucket).build()
            );
            if (!exists) {
                minioClient.makeBucket(
                        io.minio.MakeBucketArgs.builder().bucket(bucket).build()
                );
                log.info("[MinIO] Bucket '{}' créé avec succès.", bucket);
            } else {
                log.info("[MinIO] Bucket '{}' existe déjà.", bucket);
            }
        } catch (Exception e) {
            log.error("[MinIO] Impossible d'initialiser le bucket '{}': {}", bucket, e.getMessage());
        }
    }

    public static final String TOPIC_AUDIO = "creativeai.audio";
    public static final String TOPIC_VIDEO = "creativeai.video";
    public static final String TOPIC_FACE  = "creativeai.face";

    /**
     * 1. Upload le fichier dans MinIO.
     * 2. Publie seulement l'URL dans Kafka (Claim Check Pattern).
     * Le worker Python récupèrera le fichier depuis MinIO.
     */
    public String dispatchAudio(MultipartFile file, String userEmail) throws Exception {
        String jobId  = UUID.randomUUID().toString();
        String fileUrl = uploadToMinio(file, "audio/" + jobId + "/" + file.getOriginalFilename());

        SearchJobEvent event = SearchJobEvent.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .searchType("AUDIO")
                .fileUrl(fileUrl)
                .fileName(file.getOriginalFilename())
                .build();

        kafkaTemplate.send(TOPIC_AUDIO, jobId, event);
        log.info("[KAFKA] Audio job {} dispatched → MinIO: {}", jobId, fileUrl);
        return jobId;
    }

    public String dispatchVideo(MultipartFile file, String userEmail) throws Exception {
        String jobId  = UUID.randomUUID().toString();
        String fileUrl = uploadToMinio(file, "video/" + jobId + "/" + file.getOriginalFilename());

        SearchJobEvent event = SearchJobEvent.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .searchType("VIDEO")
                .fileUrl(fileUrl)
                .fileName(file.getOriginalFilename())
                .build();

        kafkaTemplate.send(TOPIC_VIDEO, jobId, event);
        log.info("[KAFKA] Video job {} dispatched", jobId);
        return jobId;
    }

    public String dispatchFace(MultipartFile image, String name,
                               String phone, String userEmail) throws Exception {
        String jobId = UUID.randomUUID().toString();
        String fileUrl = null;

        if (image != null && !image.isEmpty()) {
            fileUrl = uploadToMinio(image, "face/" + jobId + "/" + image.getOriginalFilename());
        }

        SearchJobEvent event = SearchJobEvent.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .searchType("FACE")
                .fileUrl(fileUrl)
                .textQuery(name)
                .phoneQuery(phone)
                .build();

        kafkaTemplate.send(TOPIC_FACE, jobId, event);
        log.info("[KAFKA] Face job {} dispatched", jobId);
        return jobId;
    }

    /** Upload dans MinIO et retourne l'URL d'accès. */
    private String uploadToMinio(MultipartFile file, String objectName) throws Exception {
        try (InputStream is = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(is, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        }
        // URL présignée 2h
        return minioClient.getPresignedObjectUrl(
                io.minio.GetPresignedObjectUrlArgs.builder()
                        .bucket(bucket)
                        .object(objectName)
                        .expiry(2, java.util.concurrent.TimeUnit.HOURS)
                        .method(io.minio.http.Method.GET)
                        .build()
        );
    }
}
