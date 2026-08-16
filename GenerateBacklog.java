import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import java.awt.Color;
import java.io.*;
import java.util.*;

public class GenerateBacklog {

    static final float MARGIN    = 45f;
    static final float PAGE_W    = PDRectangle.A4.getWidth();
    static final float PAGE_H    = PDRectangle.A4.getHeight();
    static final float CONTENT_W = PAGE_W - 2 * MARGIN;

    static PDDocument doc;
    static PDPage     page;
    static PDPageContentStream cs;
    static float y;

    static PDFont fontBold;
    static PDFont fontRegular;
    static PDFont fontMono;

    public static void main(String[] args) throws Exception {
        doc         = new PDDocument();
        fontBold    = PDType1Font.HELVETICA_BOLD;
        fontRegular = PDType1Font.HELVETICA;
        fontMono    = PDType1Font.COURIER;

        newPage();
        drawHeader();

        y -= 8;
        drawH1("Backlog Technique - CreativeAIStudio Platform Extension");
        drawSubtitle("Roadmap produit - Refonte UI - Nouvelles fonctionnalites - RAG Multimodal");
        y -= 6;
        drawDivider();
        y -= 4;

        drawPara("Contexte : Etendre la plateforme pour en faire un outil complet de gestion documentaire " +
                "et multimedias, competitif face aux solutions SaaS existantes (Adobe, ILovePDF, Notion, ChatPDF), " +
                "sans que l'utilisateur ait a quitter l'application.");
        y -= 8;

        drawH2("1.  Refonte UI/UX Globale (Frontend Angular)");
        drawH3("Layout & Publicite");
        drawBullet("Supprimer le panneau publicitaire flottant.");
        drawBullet("Integrer les zones publicitaires dans le header et les sidebars gauche/droite (layout 3 colonnes).");
        drawBullet("Mobile : repli en banner top/bottom, textes reduits ~10-15%, espacements compacts.");

        drawH3("Nettoyage de l'interface");
        drawBullet("Retirer les labels redondants : Creative AI Studio v2.0, IA Tri Intelligent, DocFusion, Offres MediaCore.");
        drawBullet("Corriger le bug de template dans l'historique (apostrophe non echappee dans expression Angular).");
        drawCode("{{ item.query ? 'Requete: ' + item.query : \"Analyse de fichier empreinte\" }}");

        drawH3("Historique / Activite");
        drawBullet("Reduire la taille des cards (affichage compact).");
        drawBullet("Ajouter un menu de filtres :");
        drawBullet("  * Par statut : Succes / Echec / En cours");
        drawBullet("  * Par categorie : Audio, Video, Image, DocFusion -> sous-filtres par operation");
        y -= 6;

        drawH2("2.  Recherche Media - Auto-detection du type de fichier");
        drawPara("Inspecter les magic bytes cote frontend (FileReader + signature hex) avant soumission " +
                "et selectionner automatiquement le bon mode de recherche si l'utilisateur n'a pas fait de " +
                "choix explicite. Afficher un toast : \"Fichier detecte comme audio/video/image - mode ajuste.\"");
        y -= 6;

        drawH2("3.  DocFusion - Corrections & Enrichissements");
        drawH3("Compression");
        drawBullet("Retourner un ZIP contenant le(s) fichier(s) compresse(s), ou laisser l'utilisateur choisir.");
        drawBullet("Pour les PDF : compression agressive des images embarquees (JPEG quality + downscale).");

        drawH3("Watermark");
        drawBullet("Rotation oblique par defaut (45 degres).");
        drawBullet("Options UI : orientation (0, 45, 90, personnalisee) et couleur (color picker).");

        drawH3("Fusion (Merge)");
        drawBullet("Reordonnancement drag-and-drop des fichiers avant fusion.");
        drawBullet("Formats acceptes : PDF, images (tous formats), DOCX, DOC, TXT.");
        drawBullet("Ajouter la fusion DOCX/DOC -> sortie Word (.docx) en plus du PDF.");

        drawH3("Conversion vers PDF");
        drawBullet("Accepter tous formats image : JPEG, PNG, WebP, BMP, GIF, TIFF, HEIC.");
        drawBullet("Corriger l'erreur 'Image type RIFF not supported' -> gerer WebP via TwelveMonkeys ou ffmpeg.");

        drawH3("Conversion vers DOCX / DOC");
        drawBullet("Entree : PDF, TXT, images (via OCR), DOCX, DOC. Aucun format non supporte.");

        drawH3("OCR");
        drawBullet("Supporter tous formats image : JPEG, PNG, WebP, BMP, GIF, TIFF, HEIC, PDF multi-pages.");

        drawH3("Conversions supplementaires");
        drawBullet("Encoder en Base64 : image (tous formats), PDF, DOCX, tout fichier binaire.");
        drawBullet("Decoder Base64 -> fichier telechargeable.");

        drawH3("Lecteur integre");
        drawBullet("Visionneuse inline : images, PDF (PDF.js), video/audio HTML5 natifs.");
        drawBullet("Ouverture en modal ou panneau lateral sans quitter la page.");
        y -= 6;

        drawH2("4.  Traitement MS Office - Excel & PowerPoint");
        drawH3("Excel (Apache POI)");
        drawBullet("Lecture, edition et export XLS/XLSX.");
        drawBullet("Conversion Excel -> PDF, Excel -> CSV.");
        drawBullet("Operations : fusion de classeurs, extraction de donnees, formatage.");

        drawH3("PowerPoint / Editeur de Slides");
        drawBullet("Lecture et edition PPTX (Apache POI XSLF).");
        drawBullet("Editeur de slides integre : drag-and-drop, texte, images, formes.");
        drawBullet("Export PPTX -> PDF.");
        y -= 6;

        drawH2("5.  Editeur de Texte Riche");
        drawBullet("Integrer TipTap ou Quill avec extensions avancees.");
        drawBullet("Fonctionnalites : typographie, tableaux, listes, images inline, exports (PDF, DOCX, TXT, HTML).");
        drawBullet("Modeles prets a l'emploi : CV, lettre de motivation, recommandation, conge, compte-rendu.");
        y -= 6;

        drawH2("6.  Scanner de Document & Traitement Image");
        drawH3("Scanner");
        drawBullet("Capture via webcam ou upload d'image brute.");
        drawBullet("Pipeline : deskew -> debruitage -> binarisation -> amelioration contraste.");
        drawBullet("Sortie : PDF ou DOCX au choix de l'utilisateur.");

        drawH3("Detourage d'image (Background Removal)");
        drawBullet("Integrer rembg (Python worker Kafka) ou API tierce.");
        drawBullet("Sortie PNG avec canal alpha (transparence).");
        y -= 6;

        drawH2("7.  RAG Multimodal - Chat avec ses Documents");
        drawH3("Stack technique");
        drawBullet("Spring AI (recommande, natif Spring Boot) ou LangChain4j.");
        drawBullet("pgvector (deja sur PostgreSQL) -> activer avec : CREATE EXTENSION vector;");
        drawBullet("LLM : API Claude / OpenAI configurable via variable d'environnement.");
        drawBullet("Embeddings : text-embedding-3-small (OpenAI) ou nomic-embed-text (Ollama local).");

        drawH3("Fonctionnalites");
        drawBullet("Upload fichier (PDF, DOCX, TXT, image via OCR) -> chunking -> vectorisation -> pgvector.");
        drawBullet("Interface de chat : questions en langage naturel sur le document.");
        drawBullet("Memoire de conversation (historique par session/utilisateur).");
        drawBullet("Interface vocale : STT via Whisper ou Web Speech API + TTS pour les reponses.");
        drawBullet("Cas d'usage : CV, documents administratifs, contrats, rapports.");
        y -= 6;

        drawH2("8.  Analyseur & Editeur de CV");
        drawBullet("Extraction structuree : competences, experiences, formation, langues.");
        drawBullet("Scoring et suggestions d'amelioration.");
        drawBullet("Comparaison avec une fiche de poste (matching score).");
        drawBullet("Editeur dedie avec modeles CV prets a l'emploi.");

        y -= 10;
        drawDivider();
        y -= 8;
        drawH2("Priorisation");
        drawPriorityTable();

        y -= 10;
        drawDivider();
        y -= 6;
        drawH3("Note Architecture");
        drawPara("Fonctionnalites Python (rembg, Whisper, traitement image avance) : nouveaux workers Kafka independants. " +
                "Fonctionnalites Java (POI Excel/PowerPoint, Spring AI RAG) : integration dans les microservices existants. " +
                "pgvector active via CREATE EXTENSION vector; sur la base PostgreSQL. " +
                "Aucune modification d'infrastructure majeure requise.");

        drawFooter();
        cs.close();

        String path = "/home/damien/Documents/Damien/MediaTheque/CreativeAIStudio/BACKLOG_CreativeAIStudio.pdf";
        doc.save(path);
        doc.close();
        System.out.println("PDF genere : " + path);
    }

    static void newPage() throws IOException {
        if (cs != null) cs.close();
        page = new PDPage(PDRectangle.A4);
        doc.addPage(page);
        cs = new PDPageContentStream(doc, page);
        y  = PAGE_H - MARGIN;
    }

    static void checkSpace(float needed) throws IOException {
        if (y - needed < MARGIN + 30) { drawFooter(); newPage(); }
    }

    static void drawHeader() throws IOException {
        cs.setNonStrokingColor(0.12f, 0.18f, 0.35f);
        cs.addRect(0, PAGE_H - 38, PAGE_W, 38);
        cs.fill();
        cs.setNonStrokingColor(1f, 1f, 1f);
        cs.beginText();
        cs.setFont(fontBold, 11f);
        cs.newLineAtOffset(MARGIN, PAGE_H - 25);
        cs.showText("CreativeAIStudio -- Backlog Technique & Roadmap Produit");
        cs.endText();
        cs.setNonStrokingColor(0.22f, 0.56f, 0.90f);
        cs.addRect(0, PAGE_H - 40, PAGE_W, 2);
        cs.fill();
        y = PAGE_H - 55;
    }

    static void drawFooter() throws IOException {
        int pageNum = doc.getNumberOfPages();
        cs.setNonStrokingColor(0.7f, 0.7f, 0.7f);
        cs.addRect(MARGIN, 28, CONTENT_W, 0.5f);
        cs.fill();
        cs.setNonStrokingColor(0.55f, 0.55f, 0.55f);
        cs.beginText(); cs.setFont(fontRegular, 8f);
        cs.newLineAtOffset(MARGIN, 18);
        cs.showText("CreativeAIStudio - Backlog Technique -- Confidentiel");
        cs.endText();
        cs.beginText(); cs.setFont(fontRegular, 8f);
        cs.newLineAtOffset(PAGE_W - MARGIN - 20, 18);
        cs.showText("" + pageNum);
        cs.endText();
    }

    static void drawH1(String text) throws IOException {
        checkSpace(30);
        cs.setNonStrokingColor(0.10f, 0.16f, 0.32f);
        cs.beginText(); cs.setFont(fontBold, 17f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(text); cs.endText();
        y -= 22;
    }

    static void drawSubtitle(String text) throws IOException {
        cs.setNonStrokingColor(0.35f, 0.45f, 0.65f);
        cs.beginText(); cs.setFont(fontRegular, 10f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(text); cs.endText();
        y -= 14;
    }

    static void drawH2(String text) throws IOException {
        checkSpace(28); y -= 4;
        cs.setNonStrokingColor(0.15f, 0.42f, 0.80f);
        cs.addRect(MARGIN, y - 2, 3.5f, 14f); cs.fill();
        cs.setNonStrokingColor(0.10f, 0.16f, 0.32f);
        cs.beginText(); cs.setFont(fontBold, 12.5f);
        cs.newLineAtOffset(MARGIN + 9, y);
        cs.showText(text); cs.endText();
        y -= 17;
    }

    static void drawH3(String text) throws IOException {
        checkSpace(16); y -= 3;
        cs.setNonStrokingColor(0.22f, 0.22f, 0.22f);
        cs.beginText(); cs.setFont(fontBold, 10.5f);
        cs.newLineAtOffset(MARGIN + 6, y);
        cs.showText(text); cs.endText();
        y -= 13;
    }

    static void drawBullet(String text) throws IOException {
        checkSpace(13);
        float indent = MARGIN + 10;
        cs.setNonStrokingColor(0.22f, 0.56f, 0.90f);
        cs.beginText(); cs.setFont(fontBold, 10f);
        cs.newLineAtOffset(indent - 8, y);
        cs.showText("*"); cs.endText();
        cs.setNonStrokingColor(0.15f, 0.15f, 0.15f);
        List<String> lines = wrapText(text, fontRegular, 10f, CONTENT_W - 14);
        for (String line : lines) {
            checkSpace(13);
            cs.beginText(); cs.setFont(fontRegular, 10f);
            cs.newLineAtOffset(indent, y);
            cs.showText(line); cs.endText();
            y -= 13;
        }
    }

    static void drawCode(String text) throws IOException {
        checkSpace(18);
        cs.setNonStrokingColor(0.95f, 0.95f, 0.97f);
        cs.addRect(MARGIN + 6, y - 4, CONTENT_W - 12, 16); cs.fill();
        cs.setNonStrokingColor(0.10f, 0.40f, 0.70f);
        cs.beginText(); cs.setFont(fontMono, 8.5f);
        cs.newLineAtOffset(MARGIN + 10, y);
        cs.showText(text); cs.endText();
        y -= 18;
    }

    static void drawPara(String text) throws IOException {
        List<String> lines = wrapText(text, fontRegular, 10f, CONTENT_W);
        for (String line : lines) {
            checkSpace(14);
            cs.setNonStrokingColor(0.25f, 0.25f, 0.30f);
            cs.beginText(); cs.setFont(fontRegular, 10f);
            cs.newLineAtOffset(MARGIN, y);
            cs.showText(line); cs.endText();
            y -= 13;
        }
    }

    static void drawDivider() throws IOException {
        cs.setNonStrokingColor(0.82f, 0.86f, 0.94f);
        cs.addRect(MARGIN, y, CONTENT_W, 0.8f); cs.fill();
        y -= 4;
    }

    static void drawPriorityTable() throws IOException {
        checkSpace(140);
        String[][] rows = {
            {"P0", "Corrections bugs",       "Compression ZIP, watermark 45deg, WebP RIFF fix, template Angular"},
            {"P1", "Refonte UI & filtres",   "Layout 3 colonnes, ads sidebars, filtres historique, auto-detection media"},
            {"P2", "Conversions etendues",   "Tous formats -> PDF/DOCX, Base64, OCR etendu, lecteur integre"},
            {"P3", "Editeur & merge enrichi","TipTap, modeles docs, merge DOCX, drag-and-drop reordonnancement"},
            {"P4", "Office & Scanner",       "Excel/PowerPoint, editeur slides, scanner, detourage image"},
            {"P5", "RAG Multimodal & CV",    "Chat vocal, pgvector, Spring AI, analyseur/editeur CV"},
        };
        Color[] pc = {
            new Color(200,50,50), new Color(220,100,20), new Color(190,150,0),
            new Color(30,140,70), new Color(30,100,180), new Color(100,50,180),
        };

        float colW1 = 32f, colW2 = 105f, colW3 = CONTENT_W - colW1 - colW2;
        float rowH  = 19f;
        float tx    = MARGIN;

        // header
        cs.setNonStrokingColor(0.12f, 0.18f, 0.35f);
        cs.addRect(tx, y - rowH + 4, CONTENT_W, rowH); cs.fill();
        String[] hdrs = {"Prior.", "Perimetre", "Description"};
        float[]  xpos = {tx + 6, tx + colW1 + 6, tx + colW1 + colW2 + 6};
        cs.setNonStrokingColor(1f, 1f, 1f);
        for (int i = 0; i < hdrs.length; i++) {
            cs.beginText(); cs.setFont(fontBold, 9f);
            cs.newLineAtOffset(xpos[i], y - 11); cs.showText(hdrs[i]); cs.endText();
        }
        y -= rowH + 1;

        for (int r = 0; r < rows.length; r++) {
            checkSpace(rowH + 4);
            Color bg = (r % 2 == 0) ? new Color(245,247,252) : Color.WHITE;
            cs.setNonStrokingColor(bg.getRed()/255f, bg.getGreen()/255f, bg.getBlue()/255f);
            cs.addRect(tx, y - rowH + 4, CONTENT_W, rowH); cs.fill();
            // accent strip
            cs.setNonStrokingColor(pc[r].getRed()/255f, pc[r].getGreen()/255f, pc[r].getBlue()/255f);
            cs.addRect(tx, y - rowH + 4, 4, rowH); cs.fill();
            // P-label
            cs.beginText(); cs.setFont(fontBold, 9f);
            cs.newLineAtOffset(xpos[0], y - 11); cs.showText(rows[r][0]); cs.endText();
            // perimetre
            cs.setNonStrokingColor(0.10f, 0.16f, 0.32f);
            cs.beginText(); cs.setFont(fontBold, 9f);
            cs.newLineAtOffset(xpos[1], y - 11); cs.showText(rows[r][1]); cs.endText();
            // description
            cs.setNonStrokingColor(0.20f, 0.20f, 0.20f);
            cs.beginText(); cs.setFont(fontRegular, 8.5f);
            cs.newLineAtOffset(xpos[2], y - 11); cs.showText(rows[r][2]); cs.endText();
            // separator
            cs.setNonStrokingColor(0.88f, 0.88f, 0.92f);
            cs.addRect(tx, y - rowH + 4, CONTENT_W, 0.5f); cs.fill();
            y -= rowH + 1;
        }
        y -= 6;
    }

    static List<String> wrapText(String text, PDFont font, float size, float maxW) throws IOException {
        List<String> lines = new ArrayList<>();
        String[] words = text.split(" ");
        StringBuilder cur = new StringBuilder();
        for (String word : words) {
            String test = cur.isEmpty() ? word : cur + " " + word;
            if (font.getStringWidth(test) / 1000 * size > maxW && !cur.isEmpty()) {
                lines.add(cur.toString()); cur = new StringBuilder(word);
            } else { cur = new StringBuilder(test); }
        }
        if (!cur.isEmpty()) lines.add(cur.toString());
        return lines;
    }
}
