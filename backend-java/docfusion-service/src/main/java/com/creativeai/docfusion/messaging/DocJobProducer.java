package com.creativeai.docfusion.messaging;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocJobProducer {

    private final KafkaTemplate<String, DocJobEvent> kafkaTemplate;
    private final MinioClient minioClient;

    @Value("${minio.bucket:docfusion-jobs}")
    private String bucket;

    public static final String TOPIC_PDF = "creativeai.pdf";
    public static final String TOPIC_OCR = "creativeai.ocr";

    @PostConstruct
    public void init() {
        try {
            boolean exists = minioClient.bucketExists(
                    io.minio.BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(io.minio.MakeBucketArgs.builder().bucket(bucket).build());
                log.info("[MinIO] Bucket '{}' créé.", bucket);
            }
        } catch (Exception e) {
            log.error("[MinIO] Impossible d'initialiser le bucket '{}': {}", bucket, e.getMessage());
        }
    }

    public String dispatchPdfJob(List<MultipartFile> files, String operation,
                                 Map<String, String> params, String userEmail) throws Exception {
        String jobId = UUID.randomUUID().toString();
        List<String> urls = new ArrayList<>();

        for (MultipartFile f : files) {
            String key = operation.toLowerCase() + "/" + jobId + "/" + f.getOriginalFilename();
            urls.add(uploadToMinio(f, key));
        }

        DocJobEvent event = DocJobEvent.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .operationType(operation.toUpperCase())
                .fileUrls(urls)
                .fileName(files.get(0).getOriginalFilename())
                .params(params)
                .build();

        kafkaTemplate.send(TOPIC_PDF, jobId, event);
        log.info("[KAFKA] DocFusion job {} dispatché — opération: {}", jobId, operation);
        return jobId;
    }

    public String dispatchOcrJob(MultipartFile file, String userEmail) throws Exception {
        String jobId = UUID.randomUUID().toString();
        String key   = "ocr/" + jobId + "/" + file.getOriginalFilename();
        String url   = uploadToMinio(file, key);

        DocJobEvent event = DocJobEvent.builder()
                .jobId(jobId)
                .userEmail(userEmail)
                .operationType("OCR")
                .fileUrls(List.of(url))
                .fileName(file.getOriginalFilename())
                .build();

        kafkaTemplate.send(TOPIC_OCR, jobId, event);
        log.info("[KAFKA] OCR job {} dispatché — fichier: {}", jobId, file.getOriginalFilename());
        return jobId;
    }

    private String uploadToMinio(MultipartFile file, String objectName) throws Exception {
        try (InputStream is = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(is, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        }
        return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .bucket(bucket)
                        .object(objectName)
                        .expiry(2, TimeUnit.HOURS)
                        .method(Method.GET)
                        .build()
        );
    }
}
