package com.creativeai.agentteam.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

/**
 * Valide les chemins MinIO avant tout accès.
 * Protège contre : path traversal, extensions dangereuses, taille excessive,
 * accès à des buckets non autorisés.
 */
@Slf4j
@Service
public class MediaSecurityService {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS =
        Set.of("jpg", "jpeg", "png", "gif", "webp", "heif", "tiff");

    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS =
        Set.of("mp4", "mov", "avi", "mkv");

    private static final Set<String> ALL_ALLOWED_EXTENSIONS;
    static {
        ALL_ALLOWED_EXTENSIONS = new java.util.HashSet<>();
        ALL_ALLOWED_EXTENSIONS.addAll(ALLOWED_IMAGE_EXTENSIONS);
        ALL_ALLOWED_EXTENSIONS.addAll(ALLOWED_VIDEO_EXTENSIONS);
    }

    /** 10 Mo max pour images Facebook */
    public static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
    /** 1 Go max pour vidéos Facebook (on cap à 200 Mo en pratique) */
    public static final long MAX_VIDEO_BYTES = 200L * 1024 * 1024;

    @Value("${minio.bucket}")
    private String allowedBucket;

    /**
     * Valide un object key MinIO.
     * @throws SecurityException si le chemin est suspect ou l'extension interdite
     */
    public void validateObjectKey(String objectKey) {
        if (objectKey == null || objectKey.isBlank())
            throw new SecurityException("Chemin MinIO vide ou nul");

        // Path traversal
        if (objectKey.contains("..") || objectKey.contains("//"))
            throw new SecurityException("Chemin MinIO invalide (path traversal détecté) : " + objectKey);

        // Pas de chemin absolu
        if (objectKey.startsWith("/"))
            throw new SecurityException("Chemin MinIO absolu interdit : " + objectKey);

        // Caractères dangereux
        if (objectKey.matches(".*[<>|&;$`\\\\].*"))
            throw new SecurityException("Caractères interdits dans le chemin MinIO : " + objectKey);

        // Extension obligatoire et dans la whitelist
        String ext = getExtension(objectKey);
        if (ext.isEmpty())
            throw new SecurityException("Extension manquante pour : " + objectKey);
        if (!ALL_ALLOWED_EXTENSIONS.contains(ext))
            throw new SecurityException("Extension '" + ext + "' non autorisée. Autorisées : " + ALL_ALLOWED_EXTENSIONS);
    }

    /**
     * Valide qu'un bucket est autorisé (seul le bucket configuré est permis).
     */
    public void validateBucket(String bucket) {
        if (!allowedBucket.equals(bucket))
            throw new SecurityException("Bucket '" + bucket + "' non autorisé. Bucket attendu : " + allowedBucket);
    }

    /**
     * Valide la taille du fichier téléchargé.
     */
    public void validateSize(byte[] bytes, String objectKey) {
        String ext = getExtension(objectKey);
        long size = bytes.length;
        if (ALLOWED_VIDEO_EXTENSIONS.contains(ext)) {
            if (size > MAX_VIDEO_BYTES)
                throw new SecurityException("Vidéo trop volumineuse : " + (size / 1024 / 1024) + " Mo (max 200 Mo)");
        } else {
            if (size > MAX_IMAGE_BYTES)
                throw new SecurityException("Image trop volumineuse : " + (size / 1024 / 1024) + " Mo (max 10 Mo)");
        }
    }

    /**
     * Vérifie les magic bytes pour s'assurer que le contenu correspond à l'extension.
     */
    public void validateMagicBytes(byte[] bytes, String objectKey) {
        if (bytes.length < 4) throw new SecurityException("Fichier trop petit ou corrompu");

        String ext = getExtension(objectKey);
        boolean valid = switch (ext) {
            case "jpg", "jpeg" -> bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8;
            case "png"         -> bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
            case "gif"         -> bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46;
            case "webp"        -> bytes.length >= 12 && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
            case "mp4"         -> bytes.length >= 8 && (bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70);
            // Pour les autres formats (heif, tiff, mov, avi, mkv) — on fait confiance à l'extension
            default            -> true;
        };

        if (!valid) throw new SecurityException("Contenu du fichier ne correspond pas à l'extension '" + ext + "'");
    }

    /**
     * Validation à l'ÉCRITURE d'un fichier uploadé : taille + magic bytes + type.
     * Détecte l'extension réelle à partir du contenu (jamais du nom client) pour
     * empêcher le stockage de HTML/exécutables sous une extension image/vidéo.
     */
    public record ValidatedUpload(String extension, String contentType) {}

    public ValidatedUpload validateUpload(MultipartFile file, boolean allowVideo) {
        if (file == null || file.isEmpty()) {
            throw bad("Fichier vide ou manquant.");
        }
        long size = file.getSize();
        String ext;
        String mime;
        try (InputStream in = file.getInputStream()) {
            byte[] h = new byte[16];
            int n = in.read(h);
            if (n < 4) throw bad("Fichier trop petit ou corrompu.");
            if ((h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8) { ext = "jpg"; mime = "image/jpeg"; }
            else if ((h[0] & 0xFF) == 0x89 && (h[1] & 0xFF) == 0x50 && (h[2] & 0xFF) == 0x4E && (h[3] & 0xFF) == 0x47) { ext = "png"; mime = "image/png"; }
            else if (h[0] == 'G' && h[1] == 'I' && h[2] == 'F') { ext = "gif"; mime = "image/gif"; }
            else if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && n >= 12
                    && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') { ext = "webp"; mime = "image/webp"; }
            else if (n >= 12 && h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p') { ext = "mp4"; mime = "video/mp4"; }
            else if (n >= 12 && h[4] == 'q' && h[5] == 't' && h[6] == ' ' && h[7] == ' ') { ext = "mov"; mime = "video/quicktime"; }
            else if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && n >= 12
                    && h[8] == 'A' && h[9] == 'V' && h[10] == 'I' && h[11] == ' ') { ext = "avi"; mime = "video/x-msvideo"; }
            else {
                throw bad("Format non reconnu (images : jpg/png/gif/webp, vidéos : mp4/mov/avi).");
            }
        } catch (IOException e) {
            throw bad("Impossible de lire le fichier reçu.");
        }

        boolean video = mime.startsWith("video/");
        if (video && !allowVideo) {
            throw bad("Seules les images sont autorisées sur cet endpoint.");
        }
        long max = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (size > max) {
            throw bad("Fichier trop volumineux : maximum " + (max >> 20) + " Mo.");
        }
        return new ValidatedUpload(ext, mime);
    }

    private static ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    public boolean isVideo(String objectKey) {
        return ALLOWED_VIDEO_EXTENSIONS.contains(getExtension(objectKey));
    }

    public String contentType(String objectKey) {
        return switch (getExtension(objectKey)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"         -> "image/png";
            case "gif"         -> "image/gif";
            case "webp"        -> "image/webp";
            case "mp4"         -> "video/mp4";
            case "mov"         -> "video/quicktime";
            case "avi"         -> "video/x-msvideo";
            default            -> "application/octet-stream";
        };
    }

    private String getExtension(String key) {
        int dot = key.lastIndexOf('.');
        return dot >= 0 ? key.substring(dot + 1).toLowerCase() : "";
    }
}
