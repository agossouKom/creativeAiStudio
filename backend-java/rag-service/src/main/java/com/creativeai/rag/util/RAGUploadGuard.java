package com.creativeai.rag.util;

import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Garde-fous pour l'ingestion RAG : taille max par fichier, extensions autorisées,
 * rejet des binaires dangereux / scripts / HTML par magic bytes.
 */
public final class RAGUploadGuard {

    public static final long MAX_FILE_BYTES = 30L * 1024 * 1024;
    public static final int MAX_FILES = 10;

    private static final Set<String> DOC_EXTS = Set.of(
            "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv",
            "xls", "xlsx", "ppt", "pptx"
    );

    private static final Set<String> IMAGE_EXTS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "heic", "avif"
    );

    private RAGUploadGuard() {}

    public static boolean isImage(MultipartFile file) {
        return IMAGE_EXTS.contains(extension(file.getOriginalFilename()));
    }

    /** Vérifie le fichier et retourne le nom assaini. */
    public static String check(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw bad("Fichier vide ou manquant.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw bad("Fichier trop volumineux : maximum " + (MAX_FILE_BYTES >> 20) + " Mo.");
        }
        String ext = extension(file.getOriginalFilename());
        if (!DOC_EXTS.contains(ext) && !IMAGE_EXTS.contains(ext)) {
            throw bad("Type de fichier non autorisé : '" + ext + "'.");
        }
        byte[] head = new byte[16];
        int n;
        try {
            n = file.getInputStream().read(head, 0, 16);
        } catch (Exception e) {
            throw bad("Impossible de lire le fichier reçu.");
        }
        if (n <= 0) throw bad("Fichier illisible.");
        if (looksDangerous(head, n)) {
            throw bad("Contenu de fichier refusé (exécutable ou script).");
        }
        return sanitizeName(file.getOriginalFilename());
    }

    private static boolean looksDangerous(byte[] b, int n) {
        if (n < 2) return false;
        if ((b[0] & 0xFF) == 0x4D && (b[1] & 0xFF) == 0x5A) return true;  // MZ (PE exe)
        if ((b[0] & 0xFF) == 0x7F && (b[1] & 0xFF) == 0x45) return true;  // ELF
        if (b[0] == '#' && b[1] == '!') return true;                      // shebang
        if (b[0] == '<') return true;                                     // HTML/XML/PHP
        byte[] ascii = new byte[Math.min(n, 8)];
        System.arraycopy(b, 0, ascii, 0, ascii.length);
        String s = new String(ascii, StandardCharsets.ISO_8859_1).toLowerCase();
        return s.startsWith("<?php");
    }

    private static String extension(String filename) {
        if (filename == null) return "";
        String lower = filename.toLowerCase();
        int dot = lower.lastIndexOf('.');
        return dot >= 0 ? lower.substring(dot + 1).trim() : "";
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