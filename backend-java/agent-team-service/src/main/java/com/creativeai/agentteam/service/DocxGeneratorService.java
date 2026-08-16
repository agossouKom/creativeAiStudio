package com.creativeai.agentteam.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Génère des fichiers .docx à partir du résultat d'un agent.
 * Les fichiers sont stockés dans un répertoire local et servis via /api/files/{name}.
 */
@Slf4j
@Service
public class DocxGeneratorService {

    @Value("${agent.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${agent.public-url:http://localhost:8480}")
    private String publicUrl;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final int TWIPS_PER_CM = 567;

    /**
     * Génère un fichier DOCX à partir d'un texte markdown-like.
     *
     * @param title     Titre du document
     * @param agentName Nom de l'agent auteur
     * @param content   Contenu en markdown simple (## headers, **bold**, bullet •)
     * @return URL publique de téléchargement, ou null si erreur
     */
    public GeneratedFile generate(String title, String agentName, String content) {
        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);

            String fileName = sanitizeFileName(title) + "_" + UUID.randomUUID().toString().substring(0, 8) + ".docx";
            Path filePath = dir.resolve(fileName);

            try (XWPFDocument doc = new XWPFDocument();
                 FileOutputStream out = new FileOutputStream(filePath.toFile())) {

                setPageMargins(doc);
                addTitle(doc, title);
                addMeta(doc, agentName);
                addContent(doc, content);
                doc.write(out);
            }

            String downloadUrl = publicUrl + "/api/files/" + fileName;
            log.info("[DOCX] Généré: {} → {}", fileName, downloadUrl);
            return new GeneratedFile(fileName, downloadUrl, filePath.toString());

        } catch (Exception e) {
            log.error("[DOCX] Erreur génération: {}", e.getMessage(), e);
            return null;
        }
    }

    // ── Document structure ────────────────────────────────────────────────────

    private void setPageMargins(XWPFDocument doc) {
        CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
        CTPageMar pageMar = sectPr.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(TWIPS_PER_CM * 2));
        pageMar.setBottom(BigInteger.valueOf(TWIPS_PER_CM * 2));
        pageMar.setLeft(BigInteger.valueOf(TWIPS_PER_CM * 3));
        pageMar.setRight(BigInteger.valueOf(TWIPS_PER_CM * 2));
    }

    private void addTitle(XWPFDocument doc, String title) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(200);
        XWPFRun run = p.createRun();
        run.setText(title);
        run.setBold(true);
        run.setFontSize(20);
        run.setColor("1E3A5F");
        run.setFontFamily("Calibri");
    }

    private void addMeta(XWPFDocument doc, String agentName) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(400);
        XWPFRun run = p.createRun();
        run.setText("Généré par " + agentName + " — " + LocalDateTime.now().format(DATE_FMT));
        run.setFontSize(10);
        run.setColor("888888");
        run.setItalic(true);
        run.setFontFamily("Calibri");

        // Séparateur
        XWPFParagraph sep = doc.createParagraph();
        sep.setBorderBottom(Borders.SINGLE);
        sep.setSpacingAfter(300);
    }

    private void addContent(XWPFDocument doc, String content) {
        if (content == null || content.isBlank()) return;

        for (String line : content.split("\n")) {
            String trimmed = line.trim();

            if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
                boolean h2 = trimmed.startsWith("## ");
                String text = trimmed.replaceFirst("^#{2,3}\\s+", "");
                addHeading(doc, text, h2 ? 14 : 12, h2 ? "1E3A5F" : "2E6DA4");

            } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
                String text = trimmed.replaceFirst("^[-•*]\\s+", "");
                addBullet(doc, text);

            } else if (trimmed.startsWith("| ") && trimmed.contains("|")) {
                addTableRow(doc, trimmed);

            } else if (trimmed.equals("---") || trimmed.equals("___")) {
                XWPFParagraph sep = doc.createParagraph();
                sep.setBorderBottom(Borders.SINGLE);
                sep.setSpacingAfter(200);

            } else if (!trimmed.isEmpty()) {
                addParagraph(doc, trimmed);
            } else {
                doc.createParagraph().setSpacingAfter(100);
            }
        }
    }

    private void addHeading(XWPFDocument doc, String text, int fontSize, String color) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(300);
        p.setSpacingAfter(100);
        XWPFRun run = p.createRun();
        run.setText(text);
        run.setBold(true);
        run.setFontSize(fontSize);
        run.setColor(color);
        run.setFontFamily("Calibri");
    }

    private void addBullet(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setIndentationLeft(720);
        p.setSpacingAfter(60);
        XWPFRun run = p.createRun();
        run.setText("• " + applyInlineBold(text));
        run.setFontSize(11);
        run.setFontFamily("Calibri");
    }

    private void addParagraph(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(120);
        // Handle **bold** inline
        String[] parts = text.split("\\*\\*");
        for (int i = 0; i < parts.length; i++) {
            XWPFRun run = p.createRun();
            run.setText(parts[i]);
            run.setBold(i % 2 == 1);
            run.setFontSize(11);
            run.setFontFamily("Calibri");
        }
    }

    private void addTableRow(XWPFDocument doc, String line) {
        // Simple: just render as paragraph for now (full table parsing would need state)
        addParagraph(doc, line.replaceAll("\\|", "  ").trim());
    }

    private String applyInlineBold(String text) {
        return text.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[^a-zA-Z0-9À-ÿ\\-_]", "_")
                   .replaceAll("_{2,}", "_")
                   .substring(0, Math.min(name.length(), 50));
    }

    /** Supprime les fichiers plus vieux que 7 jours. */
    public void cleanOldFiles() {
        try {
            Path dir = Paths.get(uploadDir);
            if (!Files.exists(dir)) return;
            long cutoff = System.currentTimeMillis() - 7L * 24 * 3600 * 1000;
            Files.list(dir).filter(p -> {
                try { return Files.getLastModifiedTime(p).toMillis() < cutoff; }
                catch (IOException e) { return false; }
            }).forEach(p -> { try { Files.delete(p); } catch (IOException ignored) {} });
        } catch (Exception e) {
            log.warn("[DOCX] Nettoyage fichiers: {}", e.getMessage());
        }
    }

    public record GeneratedFile(String name, String url, String localPath) {}
}
