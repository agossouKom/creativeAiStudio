package com.docfusion.gateway.controller;

import com.docfusion.gateway.service.StorageService;
import com.docfusion.gateway.service.TaskProducer;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final StorageService storageService;
    private final TaskProducer taskProducer;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        String fileName = storageService.uploadFile(file);
        taskProducer.sendOcrTask(fileName, "docfusion");
        return ResponseEntity.ok(Map.of(
                "fileName", fileName,
                "message", "File uploaded and task queued"
        ));
    }

    @GetMapping("/download/text")
    public ResponseEntity<byte[]> downloadText(@RequestParam String text, @RequestParam String fileName) {
        byte[] content = text.getBytes();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + ".txt\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(content);
    }

    @GetMapping("/download/pdf")
    public ResponseEntity<byte[]> downloadPdf(@RequestParam String text, @RequestParam String fileName) throws IOException {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);

            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.beginText();
                // Using the updated PDFBox 3.x way to set fonts
                contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                contentStream.newLineAtOffset(50, 750);
                contentStream.showText("Extracted Text from " + fileName);
                contentStream.newLineAtOffset(0, -20);
                
                String[] lines = text.split("\\s+");
                StringBuilder lineBuilder = new StringBuilder();
                for (String word : lines) {
                    if (lineBuilder.length() + word.length() > 80) {
                        contentStream.showText(lineBuilder.toString());
                        contentStream.newLineAtOffset(0, -15);
                        lineBuilder = new StringBuilder();
                    }
                    lineBuilder.append(word).append(" ");
                }
                contentStream.showText(lineBuilder.toString());
                contentStream.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + ".pdf\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(baos.toByteArray());
        }
    }
}
