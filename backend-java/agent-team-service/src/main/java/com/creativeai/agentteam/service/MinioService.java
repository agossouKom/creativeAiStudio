package com.creativeai.agentteam.service;

import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.Result;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.public-url}")
    private String publicUrl;

    public String uploadAgentPhoto(MultipartFile file) {
        return uploadToFolder(file, "agent-photos");
    }

    public String uploadProductMedia(MultipartFile file, String folder) {
        return uploadToFolder(file, "products/" + folder);
    }

    private String uploadToFolder(MultipartFile file, String folder) {
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

    /**
     * Télécharge un objet MinIO depuis le bucket par défaut.
     * L'appelant doit avoir validé objectKey via MediaSecurityService avant d'appeler cette méthode.
     */
    public byte[] downloadBytes(String objectKey) {
        return downloadBytesFromBucket(bucket, objectKey);
    }

    /**
     * Télécharge un objet MinIO depuis n'importe quel bucket (cross-bucket).
     * Utilisé pour les médias produits stockés dans pub-images.
     */
    public byte[] downloadBytesFromBucket(String bucketName, String objectKey) {
        try (InputStream is = minioClient.getObject(
                GetObjectArgs.builder().bucket(bucketName).object(objectKey).build())) {
            return is.readAllBytes();
        } catch (Exception e) {
            log.error("Erreur téléchargement MinIO bucket={} objectKey={}: {}", bucketName, objectKey, e.getMessage());
            throw new RuntimeException("Fichier introuvable dans MinIO bucket=" + bucketName + " : " + objectKey);
        }
    }

    /** Extrait (bucket, objectKey) depuis une URL publique MinIO. Retourne null si non reconnue. */
    public String[] parseMinioUrl(String url) {
        if (url == null || !url.startsWith(publicUrl + "/")) return null;
        String path = url.substring(publicUrl.length() + 1); // "bucket/object/key"
        int slash = path.indexOf('/');
        if (slash < 1) return null;
        return new String[]{ path.substring(0, slash), path.substring(slash + 1) };
    }

    /**
     * Liste les objets d'un préfixe dans le bucket.
     * Retourne les object keys (chemins relatifs).
     */
    public List<String> listObjects(String prefix, int maxResults) {
        List<String> keys = new ArrayList<>();
        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                ListObjectsArgs.builder()
                    .bucket(bucket)
                    .prefix(prefix != null ? prefix : "")
                    .recursive(true)
                    .build()
            );
            for (Result<Item> result : results) {
                keys.add(result.get().objectName());
                if (keys.size() >= maxResults) break;
            }
        } catch (Exception e) {
            log.error("Erreur listObjects MinIO prefix={}: {}", prefix, e.getMessage());
        }
        return keys;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return ".jpg";
        return "." + filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
