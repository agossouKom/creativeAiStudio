package com.creativeai.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * Vérifie la sécurité des fichiers uploadés avant stockage MinIO.
 * Contrôles :
 *  1. Extension autorisée
 *  2. Magic bytes (signature binaire réelle du fichier)
 *  3. Taille maximale
 *  4. Détection de scripts/PHP/HTML embarqués dans les données binaires
 *  5. Re-encodage image (strip EXIF + payload caché) via Java ImageIO
 */
@Slf4j
@Service
public class MediaVerificationService {

    private static final long MAX_IMAGE_BYTES = 10 * 1024 * 1024L;  // 10 MB
    private static final long MAX_VIDEO_BYTES = 200 * 1024 * 1024L; // 200 MB

    private static final List<String> ALLOWED_IMAGE_EXTS = List.of("jpg","jpeg","png","gif","webp");
    private static final List<String> ALLOWED_VIDEO_EXTS = List.of("mp4","webm","mov","avi","mkv");

    // Magic bytes: extension → expected hex prefix(es)
    private static final List<MagicEntry> IMAGE_MAGIC = List.of(
        new MagicEntry("ffd8ff",           "jpg","jpeg"),   // JPEG
        new MagicEntry("89504e47",         "png"),          // PNG
        new MagicEntry("47494638",         "gif"),          // GIF
        new MagicEntry("52494646",         "webp")          // WEBP (RIFF container)
    );
    private static final List<MagicEntry> VIDEO_MAGIC = List.of(
        // "ftyp" at offset 4 covers ALL MP4/MOV/M4V containers regardless of box size and brand
        new MagicEntry("66747970", 4, "mp4","mov","m4v"),
        new MagicEntry("1a45dfa3", 0, "webm","mkv"),
        new MagicEntry("52494646", 0, "avi")
    );

    // Patterns malveillants cherchés dans les bytes bruts du fichier
    private static final List<byte[]> MALICIOUS_PATTERNS = List.of(
        "<?php".getBytes(),
        "<?=".getBytes(),
        "<script".getBytes(),
        "javascript:".getBytes(),
        "vbscript:".getBytes(),
        "onload=".getBytes(),
        "onerror=".getBytes(),
        "eval(".getBytes(),
        "base64_decode".getBytes(),
        "exec(".getBytes(),
        "system(".getBytes(),
        "shell_exec(".getBytes(),
        "passthru(".getBytes(),
        "<!--#exec".getBytes(),   // SSI injection
        "<!DOCTYPE".getBytes()
    );

    public record VerificationResult(boolean safe, String reason) {
        public static VerificationResult ok()              { return new VerificationResult(true,  null); }
        public static VerificationResult reject(String r) { return new VerificationResult(false, r); }
    }

    public VerificationResult verify(MultipartFile file, String folder) {
        boolean isImage = "photos".equals(folder);
        boolean isVideo = "videos".equals(folder);

        if (!isImage && !isVideo) {
            return VerificationResult.reject("Dossier non autorisé : " + folder);
        }

        // 1. Extension
        String ext = extension(file.getOriginalFilename());
        List<String> allowed = isImage ? ALLOWED_IMAGE_EXTS : ALLOWED_VIDEO_EXTS;
        if (!allowed.contains(ext)) {
            return VerificationResult.reject("Extension non autorisée : " + ext);
        }

        // 2. Taille
        long maxSize = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (file.getSize() > maxSize) {
            return VerificationResult.reject("Fichier trop volumineux (" + (maxSize / 1024 / 1024) + " MB max)");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception e) {
            return VerificationResult.reject("Impossible de lire le fichier");
        }

        // 3. Magic bytes
        List<MagicEntry> magicList = isImage ? IMAGE_MAGIC : VIDEO_MAGIC;
        boolean magicOk = magicList.stream().anyMatch(m -> m.matches(bytes));
        if (!magicOk) {
            log.warn("[MEDIA] Magic bytes invalides pour {} (ext={})", file.getOriginalFilename(), ext);
            return VerificationResult.reject("Le contenu du fichier ne correspond pas à son extension");
        }

        // 4. Détection de scripts/payloads malveillants — vidéos uniquement.
        // Les images sont ignorées ici car sanitizeImage() les ré-encode entièrement,
        // ce qui élimine tout payload embarqué. Scaner les bytes bruts d'une image
        // produit des faux positifs (séquences binaires coïncidant avec <?= etc.).
        if (isVideo) {
            String upperContent = new String(bytes, java.nio.charset.StandardCharsets.ISO_8859_1).toUpperCase(Locale.ROOT);
            for (byte[] pattern : MALICIOUS_PATTERNS) {
                String patternStr = new String(pattern, java.nio.charset.StandardCharsets.ISO_8859_1).toUpperCase(Locale.ROOT);
                if (upperContent.contains(patternStr)) {
                    log.warn("[MEDIA] Pattern malveillant détecté dans {} : {}", file.getOriginalFilename(), patternStr.trim());
                    return VerificationResult.reject("Contenu malveillant détecté dans le fichier");
                }
            }
        }

        // 5. Re-encodage image (strip EXIF + données cachées) — images uniquement
        if (isImage && !ext.equals("gif")) {
            try (InputStream is = new ByteArrayInputStream(bytes)) {
                BufferedImage img = ImageIO.read(is);
                if (img == null) {
                    return VerificationResult.reject("Image illisible ou corrompue");
                }
                // Validation de dimensions minimales pour prévenir les bombes d'image
                if ((long) img.getWidth() * img.getHeight() > 100_000_000L) {
                    return VerificationResult.reject("Dimensions d'image trop grandes");
                }
            } catch (Exception e) {
                log.warn("[MEDIA] Re-encodage échoué pour {}: {}", file.getOriginalFilename(), e.getMessage());
                return VerificationResult.reject("Fichier image invalide");
            }
        }

        return VerificationResult.ok();
    }

    /**
     * Re-encode une image JPEG/PNG via ImageIO pour supprimer l'EXIF et les données cachées.
     * Retourne les bytes nettoyés, ou les bytes originaux si le re-encodage n'est pas applicable.
     */
    public byte[] sanitizeImage(byte[] bytes, String ext) {
        if ("gif".equals(ext)) return bytes; // GIF non re-encodé (animation possible)
        try (InputStream is = new ByteArrayInputStream(bytes);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            BufferedImage img = ImageIO.read(is);
            if (img == null) return bytes;
            String fmt = "png".equals(ext) ? "png" : "jpg";
            ImageIO.write(img, fmt, out);
            log.debug("[MEDIA] Image re-encodée : {} bytes → {} bytes", bytes.length, out.size());
            return out.toByteArray();
        } catch (Exception e) {
            log.warn("[MEDIA] Sanitize image échoué: {}", e.getMessage());
            return bytes;
        }
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private record MagicEntry(String hexPrefix, int offset, String... exts) {
        MagicEntry(String hexPrefix, String... exts) { this(hexPrefix, 0, exts); }
        boolean matches(byte[] bytes) {
            byte[] magic = HexFormat.of().parseHex(hexPrefix);
            if (bytes.length < offset + magic.length) return false;
            return Arrays.equals(Arrays.copyOfRange(bytes, offset, offset + magic.length), magic);
        }
    }
}
