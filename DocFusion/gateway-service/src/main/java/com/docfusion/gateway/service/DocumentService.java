package com.docfusion.gateway.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

@Service
public class DocumentService {

    public byte[] mergePDFs(byte[] pdf1, byte[] pdf2) throws IOException {
        try (PDDocument doc1 = Loader.loadPDF(pdf1);
             PDDocument doc2 = Loader.loadPDF(pdf2)) {
            PDDocument result = new PDDocument();
            doc1.getPages().forEach(result::addPage);
            doc2.getPages().forEach(result::addPage);
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            result.save(baos);
            result.close();
            return baos.toByteArray();
        }
    }

    public String extractTextFromDocx(byte[] docx) throws IOException {
        try (InputStream is = new ByteArrayInputStream(docx);
             XWPFDocument document = new XWPFDocument(is)) {
            // Logic to extract text or convert to HTML/PDF
            return "Extracted text placeholder";
        }
    }
}
