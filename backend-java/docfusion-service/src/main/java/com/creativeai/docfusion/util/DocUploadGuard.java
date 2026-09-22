package com.creativeai.docfusion.util;

import com.creativeai.docfusion.service.PdfProcessingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Garde-fous pour les uploads du Document Fusion :
 * limites de taille par fichier, extensions autorisées, rejet des binaires
 * dangereux par magic bytes (exécutables, scripts, HTML, PHP...) et
 * assainissement des noms de fichiers avant stockage.
 */
@Component
@RequiredArgsConstructor
public class DocUploadGuard {

    private final PdfProcessingService pdf;

    public static final long MAX_PER_FILE = 30L * 1024 * 1024;
    public static final long MAX_MERGE_TOTAL = 60L * 1024 * 1024;
    public static final long MAX_BASE64_ENCODE = 10L * 1024 * 1024;
    public static final long MAX_BASE64_DECODE = 30L * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTS = Set.of(
            "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv",
            "xls", "xlsx", "ppt", "pptx", "odp",
            "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff"
    );

    /** Extensions tolérées pour l'OCR (fichiers image / pdf) */
    private static final Set<String> OCR_EXTS = Set.of(
            "pdf", "jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp"
    );

    public String check(MultipartFile file, Set<String> allowedExts) {
        if (file == null || file.isEmpty()) {
            throw bad("Fichier vide ou manquant.");
        }
        if (file.getSize() > MAX_PER_FILE) {
            throw bad("Fichier trop volumineux : maximum " + (MAX_PER_FILE >> 20) + " Mo.");
        }
        byte[] head = new byte[32];
        int n;
        try {
            n = file.getInputStream().read(head, 0, 32);
        } catch (Exception e) {
            throw bad("Impossible de lire le fichier reçu.");
        }
        if (n <= 0) throw bad("Fichier illisible.");

        String ext = extension(file.getOriginalFilename());
        if (!allowedExts.contains(ext)) {
            throw bad("Type de fichier non autorisé : '" + ext + "'.");
        }
        if (looksDangerous(head, n)) {
            throw bad("Contenu de fichier refusé (type exécutable ou script).");
        }
        return sanitizeName(file.getOriginalFilename());
    }

    public String check(MultipartFile file) {
        return check(file, ALLOWED_EXTS);
    }

    public String checkOcr(MultipartFile file) {
        return check(file, OCR_EXTS);
    }

    /** Vrai si le contenu ressemble à un exécutable, un script ou du HTML/PHP. */
    private boolean looksDangerous(byte[] b, int n) {
        if (n < 2) return false;
        // PE/DOS exe, ELF
        if ((b[0] & 0xFF) == 0x4D && (b[1] & 0xFF) == 0x5A) return true;      // MZ
        if ((b[0] & 0xFF) == 0x7F && (b[1] & 0xFF) == 0x45) return true;      // ELF
        // Scripts shebang
        if (b[0] == '#' && b[1] == '!') return true;
        // HTML / XML / PHP
        if (b[0] == '<') return true;
        byte[] ascii = new byte[Math.min(n, 16)];
        System.arraycopy(b, 0, ascii, 0, ascii.length);
        String s = new String(ascii, StandardCharsets.ISO_8859_1);
        if (s.toLowerCase().startsWith("<?php")) return true;
        if (s.startsWith("PK") && n >= 4
                && (b[2] & 0xFF) == 0x03 && (b[3] & 0xFF) == 0x04) {
            // ZIP est accepté (docx/xlsx) — on ne bloque pas les archives OOXML.
            return false;
        }
        return false;
    }

    private String extension(String filename) {
        if (filename == null) return "";
        String lower = filename.toLowerCase();
        int dot = lower.lastIndexOf('.');
        return dot >= 0 ? lower.substring(dot + 1).trim() : "";
    }

    public String sanitizeDisplayName(String filename) {
        return sanitizeName(filename);
    }

    private static String sanitizeName(String original) {
        String base = original == null ? "file" : original;
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) base = base.substring(slash + 1);
        StringBuilder sb = new StringBuilder();
        for (char c : base.toCharArray()) {
            if (Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == '.') sb.append(c);
            else if (c == ' ') sb.append('_');
        }
        String cleaned = sb.toString();
        if (cleaned.isEmpty()) cleaned = "file";
        if (cleaned.length() > 80) cleaned = cleaned.substring(0, 80);
        return cleaned;
    }

    private static ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }
}