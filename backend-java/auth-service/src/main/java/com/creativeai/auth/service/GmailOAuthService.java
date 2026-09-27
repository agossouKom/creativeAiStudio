package com.creativeai.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.auth.dto.gmail.GmailEmailDto;
import com.creativeai.auth.dto.gmail.GmailSendRequest;
import com.creativeai.auth.dto.gmail.GmailStatusDto;
import com.creativeai.auth.model.GmailToken;
import com.creativeai.auth.repository.GmailTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GmailOAuthService {

    private final GmailTokenRepository tokenRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final GmailOAuthStateStore stateStore;

    @Value("${app.gmail.client-id}")
    private String clientId;

    @Value("${app.gmail.client-secret}")
    private String clientSecret;

    @Value("${app.gmail.redirect-uri}")
    private String redirectUri;

    @Value("${app.gmail.frontend-redirect}")
    private String frontendRedirect;

    private static final String GOOGLE_AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_REVOKE_URL  = "https://oauth2.googleapis.com/revoke?token=";
    private static final String GMAIL_API_BASE     = "https://gmail.googleapis.com/gmail/v1/users/me";
    private static final String USERINFO_URL       = "https://www.googleapis.com/oauth2/v3/userinfo";

    private static final String SCOPES = String.join(" ",
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send"
    );

    // ── 1. Generate Google OAuth2 Authorization URL ───────────────────────────

    /**
     * Construit l'URL de consentement Google.
     *
     * <p>{@code userId} doit provenir du JWT de l'appelant, jamais d'un paramètre
     * de requête : c'est l'ancrage de sécurité de tout le flux.
     *
     * @param requestedUserId valeur historique envoyée par le frontend ; ignorée,
     *                       et signalée si elle ne correspond pas au JWT
     */
    public String buildAuthorizationUrl(String userId, String requestedUserId) {
        if (requestedUserId != null && !requestedUserId.isBlank() && !requestedUserId.equals(userId)) {
            log.warn("[GMAIL] userId demandé ({}) ignoré : l'appelant est authentifié en tant que {}",
                requestedUserId, userId);
        }
        String state = stateStore.issue(userId);
        return GOOGLE_AUTH_URL + "?" +
            "client_id="     + encode(clientId) +
            "&redirect_uri=" + encode(redirectUri) +
            "&response_type=code" +
            "&scope="        + encode(SCOPES) +
            "&access_type=offline" +        // request refresh_token
            "&prompt=consent" +             // always show consent to get refresh_token
            "&state="        + encode(state);
    }

    // ── 2. Handle OAuth Callback (exchange code for tokens) ───────────────────

    /** Levée quand le state est inconnu, expiré ou déjà utilisé. */
    public static class InvalidStateException extends RuntimeException {
        public InvalidStateException(String message) { super(message); }
    }

    @Transactional
    public String handleCallback(String code, String state) {
        // Le state n'est plus décodé : il est consommé du store. Un state
        // inconnu, expiré ou rejoué est refusé ici, AVANT tout échange de code.
        // La consommation est volontairement hors du try principal : elle ne doit
        // jamais être confondue avec un échec d'échange de code.
        String userId;
        try {
            userId = stateStore.consume(state)
                .orElseThrow(() -> new InvalidStateException("État OAuth Gmail invalide ou expiré"));
        } catch (InvalidStateException e) {
            // On renvoie l'utilisateur vers le frontend au lieu de le laisser sur
            // une 500 : un state expiré est un incident normal (onglet resté
            // ouvert, service redémarré), pas une panne. Le state lui-même n'est
            // pas journalisé : c'est un jeton bearer d'un seul usage.
            log.warn("Gmail OAuth callback refusé — state invalide, expiré ou déjà consommé");
            return frontendRedirect + "?gmail=error&reason=state";
        }
        log.info("Gmail OAuth callback for userId={}", userId);

        try {
            // Exchange authorization code for tokens
            Map<String, Object> tokenResponse = exchangeCodeForTokens(code);

            String accessToken  = (String) tokenResponse.get("access_token");
            String refreshToken = (String) tokenResponse.get("refresh_token");
            int    expiresIn    = ((Number) tokenResponse.getOrDefault("expires_in", 3600)).intValue();

            // Fetch user's Gmail address
            String gmailEmail = fetchGmailEmail(accessToken);

            // Save or update token record
            GmailToken token = tokenRepository.findByUserId(userId).orElseGet(() ->
                GmailToken.builder().build()
            );
            token.setUserId(userId);
            token.setGmailEmail(gmailEmail);
            token.setAccessToken(accessToken);
            if (refreshToken != null) token.setRefreshToken(refreshToken);
            token.setAccessTokenExpiry(LocalDateTime.now().plusSeconds(expiresIn - 60));
            token.setConnectedAt(LocalDateTime.now());
            tokenRepository.save(token);

            log.info("Gmail connected successfully for userId={} email={}", userId, gmailEmail);
            return frontendRedirect + "?gmail=connected&email=" + encode(gmailEmail);

        } catch (Exception e) {
            log.error("Gmail OAuth callback error: {}", e.getMessage(), e);
            // Le message d'exception partait dans l'URL, donc dans l'historique
            // du navigateur et dans les logs du proxy : il peut contenir des URLs
            // de refresh token, des identifiants Google ou des noms de tables.
            // Le detail va dans les logs serveur, pas dans la redirection.
            return frontendRedirect + "?gmail=error";
        }
    }

    // ── 3. Status ─────────────────────────────────────────────────────────────

    public GmailStatusDto getStatus(String userId) {
        return tokenRepository.findByUserId(userId)
            .map(t -> new GmailStatusDto(true, t.getGmailEmail(),
                t.getConnectedAt() != null ? t.getConnectedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null))
            .orElse(new GmailStatusDto(false, null, null));
    }

    // ── 4. List Emails ────────────────────────────────────────────────────────

    public List<GmailEmailDto> listEmails(String userId, int maxResults, String labelId, String pageToken) {
        String token = getValidToken(userId);
        String url   = GMAIL_API_BASE + "/messages?maxResults=" + maxResults
                     + "&labelIds=" + (labelId != null ? labelId : "INBOX")
                     + (pageToken != null ? "&pageToken=" + pageToken : "");

        log.info("Fetching Gmail message list for userId={} maxResults={} label={}", userId, maxResults, labelId);
        JsonNode response = gmailGet(url, token);
        JsonNode messages = response.path("messages");

        if (messages.isMissingNode() || !messages.isArray()) {
            log.info("No messages found (empty inbox or API error). Raw response keys: {}", response.fieldNames());
            return List.of();
        }

        log.info("Got {} message IDs, fetching metadata...", messages.size());
        List<GmailEmailDto> emails = new ArrayList<>();
        for (JsonNode msg : messages) {
            try {
                String id    = msg.get("id").asText();
                String detailUrl = GMAIL_API_BASE + "/messages/" + id
                    + "?format=metadata"
                    + "&metadataHeaders=From"
                    + "&metadataHeaders=To"
                    + "&metadataHeaders=Subject"
                    + "&metadataHeaders=Date";
                JsonNode detail = gmailGet(detailUrl, token);
                emails.add(buildFromMetadata(detail));
            } catch (Exception e) {
                log.warn("Could not fetch email {}: {}", msg.path("id").asText(), e.getMessage());
            }
        }
        log.info("Returning {} emails for userId={}", emails.size(), userId);
        return emails;
    }

    private GmailEmailDto buildFromMetadata(JsonNode msg) {
        String id      = msg.path("id").asText();
        String threadId = msg.path("threadId").asText();
        String snippet  = msg.path("snippet").asText("");

        JsonNode headers  = msg.path("payload").path("headers");
        JsonNode labelIds = msg.path("labelIds");

        String from     = getHeader(headers, "From");
        String to       = getHeader(headers, "To");
        String subject  = getHeader(headers, "Subject");
        String date     = getHeader(headers, "Date");

        String fromName  = from.replaceAll("\\s*<.*>", "").replaceAll("\"", "").trim();
        String fromEmail = extractEmail(from);
        if (fromName.isBlank()) fromName = fromEmail;

        boolean read          = !containsLabel(labelIds, "UNREAD");
        boolean hasAttachment = false;
        List<String> labels   = parseLabels(labelIds);

        return new GmailEmailDto(
            id, threadId, fromName, fromEmail, to,
            subject, snippet, "", formatDate(date), date,
            read, hasAttachment, labels
        );
    }

    // ── 5. Get Single Email ───────────────────────────────────────────────────

    public GmailEmailDto getEmailDetail(String userId, String messageId) {
        return getEmailDetail(userId, messageId, getValidToken(userId));
    }

    private GmailEmailDto getEmailDetail(String userId, String messageId, String token) {
        String url  = GMAIL_API_BASE + "/messages/" + messageId + "?format=full";
        JsonNode msg = gmailGet(url, token);

        JsonNode headers   = msg.path("payload").path("headers");
        JsonNode labelIds  = msg.path("labelIds");

        String from     = getHeader(headers, "From");
        String to       = getHeader(headers, "To");
        String subject  = getHeader(headers, "Subject");
        String date     = getHeader(headers, "Date");
        String snippet  = msg.path("snippet").asText("");
        String threadId = msg.path("threadId").asText();

        // Parse from name + email
        String fromName  = from.replaceAll("\\s*<.*>", "").replaceAll("\"", "").trim();
        String fromEmail = extractEmail(from);
        if (fromName.isBlank()) fromName = fromEmail;

        // Extract body (prefers plain text, fallback to HTML stripped)
        String body = extractBody(msg.path("payload"));

        boolean read          = !containsLabel(labelIds, "UNREAD");
        boolean hasAttachment = checkHasAttachment(msg.path("payload"));
        List<String> labels   = parseLabels(labelIds);

        return new GmailEmailDto(
            messageId, threadId, fromName, fromEmail, to,
            subject, snippet, body, formatDate(date), date,
            read, hasAttachment, labels
        );
    }

    // ── 6. Send / Reply ───────────────────────────────────────────────────────

    public void sendEmail(String userId, GmailSendRequest req) {
        String token = getValidToken(userId);
        String rawEmail = buildRawEmail(req);
        String encoded  = Base64.getUrlEncoder().encodeToString(rawEmail.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> body = new HashMap<>();
        body.put("raw", encoded);
        if (req.threadId() != null) body.put("threadId", req.threadId());

        gmailPost(GMAIL_API_BASE + "/messages/send", token, body);
        log.info("Email sent via Gmail API to={}", req.to());
    }

    // ── 7. Mark as Read ──────────────────────────────────────────────────────

    @Transactional
    public void markEmailRead(String userId, String messageId) {
        markAsRead(messageId, getValidToken(userId));
    }

    // ── 8. Disconnect ─────────────────────────────────────────────────────────

    @Transactional
    public void disconnect(String userId) {
        tokenRepository.findByUserId(userId).ifPresent(t -> {
            try {
                // Revoke Google token
                restTemplate.postForObject(GOOGLE_REVOKE_URL + t.getAccessToken(), null, String.class);
            } catch (Exception e) {
                log.warn("Could not revoke Google token: {}", e.getMessage());
            }
            tokenRepository.deleteByUserId(userId);
        });
        log.info("Gmail disconnected for userId={}", userId);
    }

    // ── Token Management ─────────────────────────────────────────────────────

    private String getValidToken(String userId) {
        GmailToken t = tokenRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalStateException("Gmail not connected for user " + userId));

        if (t.isAccessTokenExpired() && t.getRefreshToken() != null) {
            refreshAccessToken(t);
        }
        return t.getAccessToken();
    }

    @Transactional
    protected void refreshAccessToken(GmailToken token) {
        log.debug("Refreshing Gmail access token for userId={}", token.getUserId());
        try {
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("grant_type",    "refresh_token");
            params.add("refresh_token", token.getRefreshToken());
            params.add("client_id",     clientId);
            params.add("client_secret", clientSecret);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            ResponseEntity<String> response = restTemplate.postForEntity(
                GOOGLE_TOKEN_URL, new HttpEntity<>(params, headers), String.class);

            JsonNode body = objectMapper.readTree(response.getBody());
            token.setAccessToken(body.get("access_token").asText());
            int expiresIn = body.path("expires_in").asInt(3600);
            token.setAccessTokenExpiry(LocalDateTime.now().plusSeconds(expiresIn - 60));
            tokenRepository.save(token);
        } catch (Exception e) {
            throw new RuntimeException("Failed to refresh Gmail token: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchangeCodeForTokens(String code) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code",          code);
        params.add("client_id",     clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri",  redirectUri);
        params.add("grant_type",    "authorization_code");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<Map> response = restTemplate.postForEntity(
            GOOGLE_TOKEN_URL, new HttpEntity<>(params, headers), Map.class);

        if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null)
            throw new RuntimeException("Token exchange failed: " + response.getStatusCode());
        return response.getBody();
    }

    private String fetchGmailEmail(String accessToken) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(accessToken);
        ResponseEntity<String> r = restTemplate.exchange(USERINFO_URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
        try {
            return objectMapper.readTree(r.getBody()).path("email").asText("unknown@gmail.com");
        } catch (Exception e) {
            return "unknown@gmail.com";
        }
    }

    // ── Gmail API helpers ─────────────────────────────────────────────────────

    private JsonNode gmailGet(String url, String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        try {
            ResponseEntity<String> r = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(h), String.class);
            return objectMapper.readTree(r.getBody());
        } catch (Exception e) {
            throw new RuntimeException("Gmail API GET error: " + e.getMessage(), e);
        }
    }

    private void gmailPost(String url, String token, Object body) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        try {
            restTemplate.postForEntity(url, new HttpEntity<>(body, h), String.class);
        } catch (Exception e) {
            throw new RuntimeException("Gmail API POST error: " + e.getMessage(), e);
        }
    }

    private void markAsRead(String messageId, String token) {
        try {
            Map<String, Object> body = Map.of("removeLabelIds", List.of("UNREAD"));
            gmailPost(GMAIL_API_BASE + "/messages/" + messageId + "/modify", token, body);
        } catch (Exception e) {
            log.debug("Could not mark email as read: {}", e.getMessage());
        }
    }

    // ── Parsing helpers ───────────────────────────────────────────────────────

    private String getHeader(JsonNode headers, String name) {
        for (JsonNode h : headers) {
            if (name.equalsIgnoreCase(h.path("name").asText()))
                return h.path("value").asText("");
        }
        return "";
    }

    private String extractEmail(String from) {
        if (from.contains("<") && from.contains(">"))
            return from.replaceAll(".*<(.+)>.*", "$1").trim();
        return from.trim();
    }

    private String extractBody(JsonNode payload) {
        // Try plain text first, then HTML
        String plain = findPartBody(payload, "text/plain");
        if (plain != null && !plain.isBlank()) return plain;

        String html = findPartBody(payload, "text/html");
        if (html != null) return stripHtml(html);

        // Fallback: try direct body
        String data = payload.path("body").path("data").asText("");
        return data.isBlank() ? "" : decodeBase64Url(data);
    }

    private String findPartBody(JsonNode part, String mimeType) {
        if (mimeType.equals(part.path("mimeType").asText())) {
            String data = part.path("body").path("data").asText("");
            return data.isBlank() ? null : decodeBase64Url(data);
        }
        JsonNode parts = part.path("parts");
        if (parts.isArray()) {
            for (JsonNode p : parts) {
                String result = findPartBody(p, mimeType);
                if (result != null) return result;
            }
        }
        return null;
    }

    private String decodeBase64Url(String encoded) {
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(encoded.replace(" ", "+"));
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return encoded;
        }
    }

    private String stripHtml(String html) {
        return html.replaceAll("<[^>]+>", "")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&amp;", "&")
                   .replaceAll("&lt;", "<")
                   .replaceAll("&gt;", ">")
                   .replaceAll("&quot;", "\"")
                   .replaceAll("\\s{3,}", "\n\n")
                   .trim();
    }

    private boolean containsLabel(JsonNode labels, String label) {
        for (JsonNode l : labels) if (label.equals(l.asText())) return true;
        return false;
    }

    private boolean checkHasAttachment(JsonNode payload) {
        JsonNode parts = payload.path("parts");
        if (!parts.isArray()) return false;
        for (JsonNode p : parts)
            if (!"text/plain".equals(p.path("mimeType").asText()) &&
                !"text/html".equals(p.path("mimeType").asText())) return true;
        return false;
    }

    private List<String> parseLabels(JsonNode labels) {
        List<String> result = new ArrayList<>();
        for (JsonNode l : labels) result.add(l.asText());
        return result;
    }

    private String formatDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return "—";
        try {
            // Try to extract a simple date from RFC 2822 format
            return dateStr.replaceAll("\\s*\\(.*\\)\\s*$", "").trim();
        } catch (Exception e) {
            return dateStr;
        }
    }

    private String buildRawEmail(GmailSendRequest req) {
        return "To: " + req.to() + "\r\n" +
               "Subject: " + req.subject() + "\r\n" +
               "Content-Type: text/plain; charset=UTF-8\r\n" +
               "Content-Transfer-Encoding: quoted-printable\r\n" +
               "\r\n" +
               req.body();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
