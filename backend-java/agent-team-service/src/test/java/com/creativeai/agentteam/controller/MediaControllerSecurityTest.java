package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.service.MinioService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Upload de médias : politique fail-closed.
 *
 * Régression sur le flaw tiré par l'audit : toute exception du
 * file-security-service était avalée et l'upload pursue. Un attaquant n'avait
 * qu'à inonder le scanner (ou l'arrêter) pour écrire n'importe quoi dans MinIO.
 * Ici, un scanner muet, une réponse sans verdict ou une réponse illisible
 * signifient 503 et rien n'est stocké.
 */
@ExtendWith(MockitoExtension.class)
class MediaControllerSecurityTest {

    @Mock private MinioService minioService;

    private HttpServer scanner;
    private AtomicInteger scannerHits;
    private volatile String scannerBody = "{\"safe\":true}";
    private volatile int scannerStatus = 200;

    private MediaController controller;

    @BeforeEach
    void setUp() throws IOException {
        scannerHits = new AtomicInteger();
        scanner = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        scanner.createContext("/scan", exchange -> {
            scannerHits.incrementAndGet();
            byte[] payload = scannerBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(scannerStatus, payload.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(payload);
            }
        });
        scanner.start();

        controller = new MediaController(minioService, new ObjectMapper());
        ReflectionTestUtils.setField(controller, "fileSecurityUrl", baseUrl());
    }

    @AfterEach
    void tearDown() {
        scanner.stop(0);
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + scanner.getAddress().getPort();
    }

    private static MockMultipartFile file() {
        return new MockMultipartFile("file", "logo.png", "image/png", new byte[]{
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01});
    }

    private void scannerAnswers(int status, String body) {
        scannerStatus = status;
        scannerBody = body;
    }

    // ── Fail-closed ─────────────────────────────────────────────────────────

    @Test
    void uploadRefuseEtNeStockePasQuandLeScannerEstInjoignable() throws IOException {
        // Port fermé : le scanner est "down", pas en train de refuser le fichier.
        int closedPort;
        try (ServerSocket s = new ServerSocket(0)) {
            closedPort = s.getLocalPort();
        }
        ReflectionTestUtils.setField(controller, "fileSecurityUrl", "http://127.0.0.1:" + closedPort);

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadRefuseQuandLaReponseDuScannerEstEnErreurHttp() {
        scannerAnswers(500, "{\"safe\":true}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadRefuseQuandLeVerdictSafeEstAbsent() {
        // Champ `safe` manquant : verdict inconnu. Avant, `asBoolean(true)`
        // le traduisait en « fichier sain ».
        scannerAnswers(200, "{\"filename\":\"logo.png\"}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadRefuseQuandLaReponseDuScannerEstIllisible() {
        scannerAnswers(200, "<html>502 Bad Gateway</html>");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadRefuseUnVerdictSafeNonBooleen() {
        scannerAnswers(200, "{\"safe\":\"oui\"}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    // ── Le refus explicite du scanner reste un 400 ──────────────────────────

    @Test
    void uploadRenvoie400QuandLeScannerSignaleUnFichierDangereux() {
        scannerAnswers(200, "{\"safe\":false,\"reasons\":[\"VirusTotal : 4 moteurs ont détecté ce fichier\"]}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(String.valueOf(response.getBody()).contains("VirusTotal"));
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    // ── Un 4xx du scanner est une erreur de requête, pas une panne ──────────

    @Test
    void uploadRenvoie413EtNon503QuandLeFichierDepasseLaLimiteDeTaille() {
        // Le scanner refuse un fichier trop gros. Répondre « 503, réessayez
        // plus tard » ferait croire à une panne alors qu'aucun envoi de ce
        // fichier ne peut aboutir, quel que soit le nombre de tentatives.
        scannerAnswers(413, "{\"detail\":\"Fichier .jpg trop volumineux : 20 Mo (maximum 15 Mo)\"}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, response.getStatusCode());
        assertTrue(String.valueOf(response.getBody()).contains("trop volumineux"),
            "le message du scanner doit être remonté tel quel : " + response.getBody());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadPropageLe415DuScanner() {
        scannerAnswers(415, "{\"detail\":\"Format de fichier non supporté\"}");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void uploadResteFailClosedSurUn5xxDuScanner() {
        // Cas inverse à vérifier : un 5xx du scanner n'est toujours pas un
        // verdict sur le fichier, donc toujours 503, jamais un faux 400/413.
        scannerAnswers(502, "<html>Bad Gateway</html>");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    // ── Le chemin nominal continue de fonctionner ───────────────────────────

    @Test
    void uploadEstStockeQuandLeScannerValideLeFichier() {
        scannerAnswers(200, "{\"safe\":true,\"reasons\":[]}");
        when(minioService.uploadProductMedia(any(), anyString())).thenReturn("https://cdn.test/products/uploads/x.png");

        ResponseEntity<?> response = controller.upload("user-1", file(), "uploads");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, scannerHits.get(), "le scanner n'a pas été interrogé");
        verify(minioService).uploadProductMedia(any(), org.mockito.ArgumentMatchers.eq("uploads"));
    }

    // ── Le dossier client ne doit jamais atteindre la clé d'objet MinIO ─────

    @Test
    void dossierHostileEstRefuseAvantLeScanner() {
        for (String hostile : new String[]{
                "../../etc", "products/../../secret", "a/b", "..", "uploads;rm -rf /", ""}) {
            scannerHits.set(0);

            ResponseEntity<?> response = controller.upload("user-1", file(), hostile);

            assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode(), "dossier accepté : " + hostile);
            assertEquals(0, scannerHits.get(), "le scanner a été appelé pour : " + hostile);
        }
        verify(minioService, never()).uploadProductMedia(any(), anyString());
    }

    @Test
    void dossierSimpleResteAccepte() {
        scannerAnswers(200, "{\"safe\":true}");
        when(minioService.uploadProductMedia(any(), anyString())).thenReturn("https://cdn.test/x.png");

        ResponseEntity<?> response = controller.upload("user-1", file(), "avatars_2026");

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void fichierVideEstRefuse() {
        ResponseEntity<?> response = controller.upload("user-1",
            new MockMultipartFile("file", "logo.png", "image/png", new byte[0]), "uploads");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, scannerHits.get());
    }
}
