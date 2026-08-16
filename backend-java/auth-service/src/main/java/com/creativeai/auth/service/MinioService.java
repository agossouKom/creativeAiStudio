package com.creativeai.auth.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.public-url}")
    private String publicUrl;

    public String upload(MultipartFile file, String folder) {
        String ext = getExtension(file.getOriginalFilename());
        String objectName = folder + "/" + UUID.randomUUID() + ext;
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );
            return publicUrl + "/" + bucket + "/" + objectName;
        } catch (Exception e) {
            log.error("Erreur upload MinIO: {}", e.getMessage());
            throw new RuntimeException("Échec de l'upload : " + e.getMessage());
        }
    }

    /** Upload depuis des bytes bruts (après sanitisation image). */
    public String uploadBytes(byte[] bytes, String originalFilename, String contentType, String folder) {
        String ext = getExtension(originalFilename);
        String objectName = folder + "/" + UUID.randomUUID() + ext;
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectName)
                            .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                            .contentType(contentType)
                            .build()
            );
            return publicUrl + "/" + bucket + "/" + objectName;
        } catch (Exception e) {
            log.error("Erreur uploadBytes MinIO: {}", e.getMessage());
            throw new RuntimeException("Échec de l'upload : " + e.getMessage());
        }
    }

    public List<String> uploadAll(List<MultipartFile> files, String folder) {
        List<String> urls = new ArrayList<>();
        for (MultipartFile f : files) {
            urls.add(upload(f, folder));
        }
        return urls;
    }

    public String presignedUrl(String objectName) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(objectName)
                            .expiry(7, TimeUnit.DAYS)
                            .build()
            );
        } catch (Exception e) {
            throw new RuntimeException("Erreur presigned URL: " + e.getMessage());
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return "." + filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
