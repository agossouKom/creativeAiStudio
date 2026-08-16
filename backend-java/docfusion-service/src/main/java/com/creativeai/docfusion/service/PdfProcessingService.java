package com.creativeai.docfusion.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.multipdf.Splitter;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.util.Matrix;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;
import java.util.List;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
public class PdfProcessingService {

    // Force ImageIO to scan & register TwelveMonkeys plugins (WebP, TIFF, etc.)
    static {
        ImageIO.scanForPlugins();
        log.info("[ImageIO] Plugins enregistrés : {}", java.util.Arrays.toString(ImageIO.getReaderFormatNames()));
    }

    private static final int   COMPRESS_MAX_W  = 1200;
    private static final float WATERMARK_SIZE  = 52f;
    private static final float WATERMARK_ALPHA = 0.22f;

    // ─── Detection par magic bytes ────────────────────────────────────────────

    public enum FileType { PDF, IMAGE, DOCX, DOC, TXT }

    public FileType detectType(byte[] data) {
        if (data.length < 4) return FileType.TXT;
        if (data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46) return FileType.PDF;
        if (data[0] == (byte)0x89 && data[1] == 0x50) return FileType.IMAGE;           // PNG
        if (data[0] == (byte)0xFF && data[1] == (byte)0xD8)                            return FileType.IMAGE; // JPEG
        if (data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46)                    return FileType.IMAGE; // GIF
        if (data[0] == 0x42 && data[1] == 0x4D)                                        return FileType.IMAGE; // BMP
        if (data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46) return FileType.IMAGE; // RIFF/WebP
        if (data[0] == 0x49 && data[1] == 0x49 && data[2] == 0x2A && data[3] == 0x00) return FileType.IMAGE; // TIFF LE
        if (data[0] == 0x4D && data[1] == 0x4D && data[2] == 0x00 && data[3] == 0x2A) return FileType.IMAGE; // TIFF BE
        if (data[0] == 0x50 && data[1] == 0x4B)                                        return FileType.DOCX;  // ZIP/DOCX/XLSX/PPTX
        if (data[0] == (byte)0xD0 && data[1] == (byte)0xCF)                            return FileType.DOC;
        return FileType.TXT;
    }

    // ─── Conversion vers PDF ──────────────────────────────────────────────────

    public byte[] toPdf(byte[] data, String filename) throws IOException {
        FileType type = detectType(data);
        return switch (type) {
            case PDF   -> data;
            case IMAGE -> imageToPdf(data, filename != null ? filename : "image");
            case DOCX  -> docxToPdf(data);
            case DOC   -> docToPdf(data);
            case TXT   -> textToPdf(data, filename);
        };
    }

    private byte[] imageToPdf(byte[] imageData, String name) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDImageXObject img;
            try {
                // Tentative directe PDFBox (JPEG, PNG, BMP natifs)
                img = PDImageXObject.createFromByteArray(doc, imageData, name);
            } catch (Exception e) {
                log.debug("[IMAGE] Fallback BufferedImage pour: {} ({})", name, e.getMessage());
                img = convertViaBufferedImage(doc, imageData);
            }
            float w = Math.min(img.getWidth(), 2480f);
            float h = img.getHeight() * (w / img.getWidth());
            PDPage page = new PDPage(new PDRectangle(w, h));
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.drawImage(img, 0, 0, w, h);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    /**
     * Fallback via BufferedImage — gère WebP (TwelveMonkeys), TIFF, HEIC, etc.
     * Converts to JPEG in-memory for PDFBox compatibility.
     */
    private PDImageXObject convertViaBufferedImage(PDDocument doc, byte[] imageData) throws IOException {
        // Ensure TwelveMonkeys plugins are loaded for this thread's IIORegistry
        ImageIO.scanForPlugins();

        BufferedImage bimg = null;

        // ① Try ImageIO directly (picks up TwelveMonkeys WebP/TIFF plugins)
        try {
            bimg = ImageIO.read(new ByteArrayInputStream(imageData));
        } catch (Exception ex) {
            log.debug("[ImageIO] Lecture directe échouée: {}", ex.getMessage());
        }

        // ② If still null and RIFF/WebP header — try reading with explicit "webp" reader
        if (bimg == null && imageData.length > 12
                && imageData[0] == 0x52 && imageData[1] == 0x49
                && imageData[2] == 0x46 && imageData[3] == 0x46) {
            try {
                javax.imageio.ImageReader reader = ImageIO.getImageReadersByFormatName("webp").next();
                reader.setInput(ImageIO.createImageInputStream(new ByteArrayInputStream(imageData)));
                bimg = reader.read(0);
                log.debug("[ImageIO] WebP décodé via reader explicite");
            } catch (Exception ex) {
                log.warn("[ImageIO] Décodage WebP échoué: {}", ex.getMessage());
            }
        }

        if (bimg == null) {
            throw new IOException(
                "Format d'image non reconnu (WebP/TIFF/HEIC) — " +
                "vérifiez que la dépendance imageio-webp est bien sur le classpath");
        }

        // ③ Flatten alpha channel to white background (avoid black JPEG)
        if (bimg.getColorModel().hasAlpha()) {
            BufferedImage rgb = new BufferedImage(bimg.getWidth(), bimg.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g2 = rgb.createGraphics();
            g2.setColor(Color.WHITE);
            g2.fillRect(0, 0, bimg.getWidth(), bimg.getHeight());
            g2.drawImage(bimg, 0, 0, null);
            g2.dispose();
            bimg = rgb;
        } else if (bimg.getType() != BufferedImage.TYPE_INT_RGB) {
            BufferedImage rgb = new BufferedImage(bimg.getWidth(), bimg.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g2 = rgb.createGraphics();
            g2.drawImage(bimg, 0, 0, Color.WHITE, null);
            g2.dispose();
            bimg = rgb;
        }

        ByteArrayOutputStream jpegOut = new ByteArrayOutputStream();
        ImageIO.write(bimg, "JPEG", jpegOut);
        return PDImageXObject.createFromByteArray(doc, jpegOut.toByteArray(), "converted.jpg");
    }

    private byte[] docxToPdf(byte[] docxData) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (XWPFDocument docx = new XWPFDocument(new ByteArrayInputStream(docxData))) {
            for (XWPFParagraph p : docx.getParagraphs()) {
                sb.append(p.getText()).append("\n");
            }
        }
        return textToPdf(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8), "converted.pdf");
    }

    private byte[] docToPdf(byte[] docData) throws IOException {
        String text;
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(docData));
             WordExtractor extractor = new WordExtractor(doc)) {
            text = extractor.getText();
        }
        return textToPdf(text.getBytes(java.nio.charset.StandardCharsets.UTF_8), "converted.pdf");
    }

    public byte[] textToPdf(byte[] textData, String filename) throws IOException {
        String text;
        try {
            text = new String(textData, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            text = new String(textData);
        }
        try (PDDocument doc = new PDDocument()) {
            float margin   = 50f;
            float fontSize = 11f;
            float leading  = fontSize * 1.55f;
            float pageW    = PDRectangle.A4.getWidth();
            float pageH    = PDRectangle.A4.getHeight();

            String[] lines = text.split("\n");
            PDPage page = null;
            PDPageContentStream cs = null;
            float y = 0f;

            for (String line : lines) {
                if (page == null || y < margin + leading) {
                    if (cs != null) { cs.endText(); cs.close(); }
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    cs.setFont(PDType1Font.HELVETICA, fontSize);
                    cs.beginText();
                    y = pageH - margin;
                    cs.newLineAtOffset(margin, y);
                }
                cs.showText(sanitize(line));
                cs.newLineAtOffset(0, -leading);
                y -= leading;
            }
            if (cs != null) { cs.endText(); cs.close(); }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private String sanitize(String s) {
        if (s == null) return "";
        return s.chars()
                .filter(c -> c >= 0x20 && c <= 0x7E)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                .toString();
    }

    // ─── Merge ────────────────────────────────────────────────────────────────

    public byte[] mergeBytes(List<byte[]> filesData, List<String> fileNames) throws IOException {
        PDFMergerUtility merger = new PDFMergerUtility();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        merger.setDestinationStream(out);
        for (int i = 0; i < filesData.size(); i++) {
            String name = (fileNames != null && i < fileNames.size()) ? fileNames.get(i) : "file";
            byte[] pdf  = toPdf(filesData.get(i), name);
            merger.addSource(new ByteArrayInputStream(pdf));
        }
        merger.mergeDocuments(null);
        return out.toByteArray();
    }

    // ─── Split ────────────────────────────────────────────────────────────────

    public byte[] split(byte[] pdfData, int start, int end) throws IOException {
        if (detectType(pdfData) != FileType.PDF) {
            throw new IllegalArgumentException("Decoupage impossible : le fichier n'est pas un PDF valide. Formats acceptes : PDF");
        }
        try (PDDocument src = PDDocument.load(pdfData)) {
            int total = src.getNumberOfPages();
            int s = Math.max(1, start);
            int e = Math.min(total, end);
            if (s > e) throw new IllegalArgumentException("Plage invalide: " + s + "-" + e + " (doc=" + total + "p)");
            Splitter splitter = new Splitter();
            splitter.setStartPage(s);
            splitter.setEndPage(e);
            splitter.setSplitAtPage(e - s + 1);
            List<PDDocument> parts = splitter.split(src);
            if (parts.isEmpty()) throw new IllegalArgumentException("Aucune page extraite");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            parts.get(0).save(out);
            for (PDDocument p : parts) p.close();
            return out.toByteArray();
        }
    }

    // ─── Compress (images + ZIP) ──────────────────────────────────────────────

    /**
     * Compresse un PDF : downscale + recompression JPEG des images embedees.
     * @param outputFormat "pdf" = PDF compresse, "zip" = ZIP contenant le PDF
     */
    public byte[] compress(byte[] pdfData, String outputFormat, String originalName) throws IOException {
        if (detectType(pdfData) != FileType.PDF) {
            throw new IllegalArgumentException("Compression impossible : le fichier n'est pas un PDF. Formats acceptes : PDF");
        }
        byte[] compressedPdf = compressPdfImages(pdfData);

        if ("zip".equalsIgnoreCase(outputFormat)) {
            String entryName = originalName != null
                    ? originalName.replaceAll("(?i)\\.pdf$", "_compressed.pdf")
                    : "compressed.pdf";
            ByteArrayOutputStream zipOut = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(zipOut)) {
                zip.setLevel(Deflater.BEST_COMPRESSION);
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(compressedPdf);
                zip.closeEntry();
            }
            return zipOut.toByteArray();
        }
        return compressedPdf;
    }

    private byte[] compressPdfImages(byte[] pdfData) throws IOException {
        try (PDDocument doc = PDDocument.load(pdfData)) {
            for (PDPage page : doc.getPages()) {
                PDResources res = page.getResources();
                if (res == null) continue;
                for (org.apache.pdfbox.cos.COSName name : res.getXObjectNames()) {
                    try {
                        org.apache.pdfbox.pdmodel.graphics.PDXObject xobj = res.getXObject(name);
                        if (!(xobj instanceof PDImageXObject)) continue;
                        PDImageXObject img = (PDImageXObject) xobj;
                        if (img.getWidth() <= COMPRESS_MAX_W) continue;

                        BufferedImage bimg = img.getImage();
                        int newW = COMPRESS_MAX_W;
                        int newH = (int) ((double) bimg.getHeight() * newW / bimg.getWidth());

                        BufferedImage scaled = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
                        Graphics2D g = scaled.createGraphics();
                        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                        g.drawImage(bimg, 0, 0, newW, newH, null);
                        g.dispose();

                        PDImageXObject newImg = JPEGFactory.createFromImage(doc, scaled, 0.72f);
                        res.getCOSObject()
                           .getCOSDictionary(org.apache.pdfbox.cos.COSName.XOBJECT)
                           .setItem(name, newImg);
                        log.debug("[COMPRESS] Image {} reduite {}px -> {}px", name.getName(), img.getWidth(), newW);
                    } catch (Exception ex) {
                        log.warn("[COMPRESS] Impossible de recompresser {}: {}", name.getName(), ex.getMessage());
                    }
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ─── Watermark (rotation + couleur) ──────────────────────────────────────

    /**
     * @param text      Texte du filigrane
     * @param rotDeg    Angle en degres (0, 45, 90, valeur libre)
     * @param hexColor  Couleur HTML (#RRGGBB) ou null -> gris
     */
    public byte[] watermark(byte[] pdfData, String text, float rotDeg, String hexColor) throws IOException {
        if (detectType(pdfData) != FileType.PDF) {
            throw new IllegalArgumentException("Filigrane impossible : le fichier n'est pas un PDF. Formats acceptes : PDF");
        }
        // Parse couleur
        Color color;
        try {
            color = (hexColor != null && hexColor.startsWith("#"))
                    ? Color.decode(hexColor)
                    : new Color(128, 128, 128);
        } catch (NumberFormatException e) {
            color = new Color(128, 128, 128);
        }
        float cr = color.getRed()   / 255f;
        float cg = color.getGreen() / 255f;
        float cb = color.getBlue()  / 255f;
        float angleRad = (float) Math.toRadians(rotDeg);

        try (PDDocument doc = PDDocument.load(pdfData)) {
            PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
            gs.setNonStrokingAlphaConstant(WATERMARK_ALPHA);
            gs.setAlphaSourceFlag(true);

            for (PDPage page : doc.getPages()) {
                float w = page.getMediaBox().getWidth();
                float h = page.getMediaBox().getHeight();

                // Largeur du texte pour centrage
                float textWidth;
                try {
                    textWidth = PDType1Font.HELVETICA_BOLD.getStringWidth(sanitize(text)) / 1000f * WATERMARK_SIZE;
                } catch (Exception e) {
                    textWidth = 200f;
                }

                // Centre de page, decale pour centrer le texte
                float cx = w / 2f - textWidth / 2f * (float) Math.cos(angleRad);
                float cy = h / 2f - textWidth / 2f * (float) Math.sin(angleRad);

                try (PDPageContentStream cs = new PDPageContentStream(
                        doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    cs.saveGraphicsState();
                    cs.setGraphicsStateParameters(gs);
                    cs.setFont(PDType1Font.HELVETICA_BOLD, WATERMARK_SIZE);
                    cs.setNonStrokingColor(cr, cg, cb);
                    cs.beginText();
                    cs.setTextMatrix(Matrix.getRotateInstance(angleRad, cx, cy));
                    cs.showText(sanitize(text));
                    cs.endText();
                    cs.restoreGraphicsState();
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ─── PDF / Image → DOCX ──────────────────────────────────────────────────

    public byte[] pdfToDocx(byte[] pdfData) throws IOException {
        FileType type = detectType(pdfData);

        // Image → DOCX : intègre l'image dans le document Word
        if (type == FileType.IMAGE) {
            return imageToDocx(pdfData);
        }

        // Autres formats non-PDF : extraction texte
        if (type != FileType.PDF) {
            String text = extractText(pdfData, type, "input");
            try (XWPFDocument docx = new XWPFDocument()) {
                for (String line : text.split("\n")) {
                    docx.createParagraph().createRun().setText(line);
                }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                docx.write(out);
                return out.toByteArray();
            }
        }

        // PDF → extraction texte
        String text;
        try (PDDocument doc = PDDocument.load(pdfData)) {
            org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
            text = stripper.getText(doc);
        }
        try (XWPFDocument docx = new XWPFDocument()) {
            for (String line : text.split("\n")) {
                XWPFParagraph p = docx.createParagraph();
                p.createRun().setText(line);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            docx.write(out);
            return out.toByteArray();
        }
    }

    /** Intègre une image dans un document DOCX (POI AddPicture) */
    private byte[] imageToDocx(byte[] imageData) throws IOException {
        // Ensure TwelveMonkeys plugins are loaded
        ImageIO.scanForPlugins();
        // Décoder l'image pour obtenir les dimensions
        BufferedImage bimg = ImageIO.read(new ByteArrayInputStream(imageData));
        if (bimg == null) {
            // Fallback si ImageIO ne reconnait pas le format
            throw new IOException("Format d'image non reconnu pour la conversion DOCX (WebP/TIFF) — vérifiez imageio-webp sur le classpath");
        }

        // Déterminer le type POI et convertir si nécessaire (WebP → JPEG)
        int picType = detectPoiPictureType(imageData);
        byte[] finalImageBytes = imageData;
        if (picType == -1) {
            // Format non supporté nativement par POI (ex: WebP, TIFF) → JPEG
            BufferedImage rgb = new BufferedImage(bimg.getWidth(), bimg.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(bimg, 0, 0, Color.WHITE, null);
            g.dispose();
            ByteArrayOutputStream jpegOut = new ByteArrayOutputStream();
            ImageIO.write(rgb, "JPEG", jpegOut);
            finalImageBytes = jpegOut.toByteArray();
            picType = XWPFDocument.PICTURE_TYPE_JPEG;
        }

        // Dimensions en EMU — max 15cm de large (≈ marges Word standard)
        final int maxEmuW = (int) Units.toEMU(425); // ~15cm en points
        int emuW = (int) Units.toEMU(bimg.getWidth());
        int emuH = (int) Units.toEMU(bimg.getHeight());
        if (emuW > maxEmuW) {
            double ratio = (double) maxEmuW / emuW;
            emuW = maxEmuW;
            emuH = (int) (emuH * ratio);
        }

        try (XWPFDocument docx = new XWPFDocument()) {
            // Titre
            XWPFParagraph titlePara = docx.createParagraph();
            XWPFRun titleRun = titlePara.createRun();
            titleRun.setBold(true);
            titleRun.setFontSize(14);
            titleRun.setText("Image convertie en document Word");

            // Paragraph vide
            docx.createParagraph();

            // Paragraphe image
            XWPFParagraph imgPara = docx.createParagraph();
            XWPFRun imgRun = imgPara.createRun();
            imgRun.addPicture(new ByteArrayInputStream(finalImageBytes), picType, "image", emuW, emuH);

            // Note OCR
            docx.createParagraph();
            XWPFParagraph notePara = docx.createParagraph();
            XWPFRun noteRun = notePara.createRun();
            noteRun.setItalic(true);
            noteRun.setFontSize(9);
            noteRun.setText("Conseil : utilisez l'OCR pour extraire le texte contenu dans cette image.");

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            docx.write(out);
            return out.toByteArray();
        } catch (org.apache.poi.openxml4j.exceptions.InvalidFormatException e) {
            throw new IOException("Impossible d'integrer l'image dans le DOCX : " + e.getMessage(), e);
        }
    }

    /** Retourne le type POI pour une image, ou -1 si non supporté nativement */
    private int detectPoiPictureType(byte[] data) {
        if (data.length < 4) return -1;
        if (data[0] == (byte)0xFF && data[1] == (byte)0xD8)              return XWPFDocument.PICTURE_TYPE_JPEG;
        if (data[0] == (byte)0x89 && data[1] == 0x50)                    return XWPFDocument.PICTURE_TYPE_PNG;
        if (data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46)       return XWPFDocument.PICTURE_TYPE_GIF;
        if (data[0] == 0x42 && data[1] == 0x4D)                          return XWPFDocument.PICTURE_TYPE_DIB;
        return -1; // WebP (RIFF), TIFF → conversion JPEG
    }

    // ─── Base64 ───────────────────────────────────────────────────────────────

    public String encodeBase64(byte[] data) {
        return Base64.getEncoder().encodeToString(data);
    }

    public byte[] decodeBase64(String base64) {
        String cleaned = base64.replaceAll("\\s+", "");
        // Supprimer le prefixe Data URL si present : data:...;base64,XXXX
        if (cleaned.contains(",")) {
            cleaned = cleaned.substring(cleaned.lastIndexOf(',') + 1);
        }
        // Supprimer les caracteres non-Base64 residuels (hors +/= et alphanum)
        cleaned = cleaned.replaceAll("[^A-Za-z0-9+/=]", "");
        // Padding si manquant
        int pad = cleaned.length() % 4;
        if (pad == 2)      cleaned += "==";
        else if (pad == 3) cleaned += "=";
        return Base64.getDecoder().decode(cleaned);
    }

    // ─── DOCX merge ──────────────────────────────────────────────────────────

    /** Fusionne plusieurs DOCX/TXT en un seul DOCX */
    public byte[] mergeToDocx(List<byte[]> filesData, List<String> fileNames) throws IOException {
        try (XWPFDocument merged = new XWPFDocument()) {
            for (int i = 0; i < filesData.size(); i++) {
                byte[] data = filesData.get(i);
                String name = (fileNames != null && i < fileNames.size()) ? fileNames.get(i) : "file";
                FileType type = detectType(data);

                String text = extractText(data, type, name);
                if (i > 0) {
                    // Saut de page entre documents
                    XWPFParagraph sep = merged.createParagraph();
                    sep.setPageBreak(true);
                }
                for (String line : text.split("\n")) {
                    merged.createParagraph().createRun().setText(line);
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            merged.write(out);
            return out.toByteArray();
        }
    }

    private String extractText(byte[] data, FileType type, String name) throws IOException {
        return switch (type) {
            case PDF -> {
                try (PDDocument doc = PDDocument.load(data)) {
                    yield new org.apache.pdfbox.text.PDFTextStripper().getText(doc);
                }
            }
            case DOCX -> {
                StringBuilder sb = new StringBuilder();
                try (XWPFDocument docx = new XWPFDocument(new ByteArrayInputStream(data))) {
                    for (XWPFParagraph p : docx.getParagraphs()) sb.append(p.getText()).append("\n");
                }
                yield sb.toString();
            }
            case DOC -> {
                try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(data));
                     WordExtractor ext = new WordExtractor(doc)) {
                    yield ext.getText();
                }
            }
            default -> new String(data, java.nio.charset.StandardCharsets.UTF_8);
        };
    }
}
