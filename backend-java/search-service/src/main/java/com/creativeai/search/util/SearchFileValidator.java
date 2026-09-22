package com.creativeai.search.util;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Durcissement des uploads du moteur de recherche :
 * limite de taille, vérification du contenu par magic bytes (jamais le nom ou le Content-Type client),
 * refus des formats non médias (scripts, exécutables, HTML, archives...), nom de fichier assaini
 * avant stockage MinIO.
 */
public final class SearchFileValidator {

    public enum Kind { AUDIO, VIDEO, IMAGE }

    public record Validated(String storedName, String extension, String contentType) {}

    public static final long MAX_AUDIO = 100L * 1024 * 1024;
    public static final long MAX_VIDEO = 150L * 1024 * 1024;
    public static final long MAX_IMAGE = 20L * 1024 * 1024;

    private SearchFileValidator() {}

    public static Validated validate(MultipartFile file, Kind kind) {
        if (file == null || file.isEmpty()) {
            throw bad("Fichier vide ou manquant.");
        }
        long max = switch (kind) {
            case AUDIO -> MAX_AUDIO;
            case VIDEO -> MAX_VIDEO;
            case IMAGE -> MAX_IMAGE;
        };
        if (file.getSize() > max) {
            throw bad("Fichier trop volumineux : maximum " + (max >> 20) + " Mo.");
        }

        byte[] head = new byte[512];
        int n = 0;
        try (InputStream in = file.getInputStream()) {
            n = in.read(head);
        } catch (IOException e) {
            throw bad("Impossible de lire le fichier reçu.");
        }
        if (n <= 0) {
            throw bad("Fichier vide ou illisible.");
        }

        Detected detected = detect(head, n);
        if (detected == null) {
            throw bad("Type de fichier non reconnu ou non supporté.");
        }
        if (!allowedFor(detected, kind)) {
            throw bad("Type de fichier non autorisé pour ce type de recherche (attendu : "
                    + (kind == Kind.AUDIO ? "audio" : kind == Kind.VIDEO ? "vidéo" : "image") + ").");
        }

        String storedName = sanitizeName(file.getOriginalFilename(), detected.ext);
        return new Validated(storedName, detected.ext, detected.mime);
    }

    // ── Détection par magic bytes ──────────────────────────────────────────────

    private record Detected(String ext, String mime) {}

    private static Detected detect(byte[] b, int n) {
        if (startsWith(b, new int[]{0xFF, 0xD8, 0xFF}))            return new Detected("jpg", "image/jpeg");
        if (startsWith(b, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})) return new Detected("png", "image/png");
        if (startsWithAscii(b, "GIF8"))                            return new Detected("gif", "image/gif");
        if (startsWithAscii(b, "BM"))                              return new Detected("bmp", "image/bmp");
        if (startsWithAscii(b, "MM\u0000*") || startsWithAscii(b, "II*\u0000")) return new Detected("tiff", "image/tiff");
        if (startsWithAscii(b, "ID3"))                             return new Detected("mp3", "audio/mpeg");
        if (startsWithAscii(b, "OggS"))                            return new Detected("ogg", "audio/ogg");
        if (startsWithAscii(b, "fLaC"))                            return new Detected("flac", "audio/flac");
        if (startsWithAscii(b, "#!AMR"))                           return new Detected("amr", "audio/amr");
        if (startsWithAscii(b, "RIFF") && n >= 12) {
            if (startsWithAscii(b, 8, "WAVE")) return new Detected("wav", "audio/wav");
            if (startsWithAscii(b, 8, "AVI ")) return new Detected("avi", "video/x-msvideo");
            if (startsWithAscii(b, 8, "WEBP")) return new Detected("webp", "image/webp");
            if (startsWithAscii(b, 8, "AIFF")) return new Detected("aiff", "audio/aiff");
        }
        // MP4/MOV/M4A : boîte ISO BMFF — 'ftyp' en tête (offset 0) ou juste après la taille de boîte (offset 4)
        if (startsWithAscii(b, "ftyp") || (n >= 8 && startsWithAscii(b, 4, "ftyp"))) {
            if (n >= 12 && (startsWithAscii(b, 8, "M4A ") || startsWithAscii(b, 8, "M4B "))) {
                return new Detected("m4a", "audio/mp4");
            }
            return new Detected("mp4", "video/mp4");
        }
        if (startsWith(b, new int[]{0x1A, 0x45, 0xDF, 0xA3}))      return new Detected("webm", "video/webm"); // matroska/webm
        if (startsWith(b, new int[]{0x00, 0x00, 0x01, 0xBA}))      return new Detected("mpg", "video/mpeg");
        if (startsWith(b, new int[]{0x00, 0x00, 0x01, 0xB3}))      return new Detected("mpg", "video/mpeg");
        // MP3 sans tag ID3 : frame sync 0xFF Ex (byte 1 & 0xE0 == 0xE0)
        if (n >= 2 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xE0) == 0xE0) return new Detected("mp3", "audio/mpeg");
        // ASF / WMV
        if (startsWith(b, new int[]{0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9})) return new Detected("wmv", "video/x-ms-wmv");
        return null;
    }

    private static boolean allowedFor(Detected d, Kind kind) {
        return switch (kind) {
            case AUDIO -> d.mime.startsWith("audio/");
            case VIDEO -> d.mime.startsWith("video/");
            case IMAGE -> d.mime.startsWith("image/");
        };
    }

    // ── Assainissement du nom de fichier ───────────────────────────────────────

    private static String sanitizeName(String original, String ext) {
        String base = original == null ? "" : original;
        // Ne garder que le dernier segment (anti ../, anti C:\...)
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) base = base.substring(slash + 1);
        StringBuilder sb = new StringBuilder();
        for (char c : base.toCharArray()) {
            if (Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == '.') {
                sb.append(c);
            } else if (c == ' ') {
                sb.append('_');
            }
        }
        String cleaned = sb.toString();
        if (cleaned.isEmpty()) cleaned = "upload";
        int dot = cleaned.lastIndexOf('.');
        String stem = dot > 0 ? cleaned.substring(0, dot) : cleaned;
        stem = stem.replaceAll("[.]{2,}", "-");
        if (stem.isEmpty()) stem = "upload";
        if (stem.length() > 80) stem = stem.substring(0, 80);
        return stem + "." + ext;
    }

    private static boolean startsWith(byte[] b, int[] magic) {
        if (b.length < magic.length) return false;
        for (int i = 0; i < magic.length; i++) {
            if ((b[i] & 0xFF) != (magic[i] & 0xFF)) return false;
        }
        return true;
    }

    private static boolean startsWithAscii(byte[] b, String s) {
        byte[] m = s.getBytes(StandardCharsets.US_ASCII);
        if (b.length < m.length) return false;
        for (int i = 0; i < m.length; i++) {
            if (b[i] != m[i]) return false;
        }
        return true;
    }

    private static boolean startsWithAscii(byte[] b, int offset, String s) {
        byte[] m = s.getBytes(StandardCharsets.US_ASCII);
        if (b.length < offset + m.length) return false;
        for (int i = 0; i < m.length; i++) {
            if (b[offset + i] != m[i]) return false;
        }
        return true;
    }

    private static ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }
}