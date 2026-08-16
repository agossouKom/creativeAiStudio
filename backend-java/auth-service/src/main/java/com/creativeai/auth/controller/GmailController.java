package com.creativeai.auth.controller;

import com.creativeai.auth.dto.gmail.GmailEmailDto;
import com.creativeai.auth.dto.gmail.GmailSendRequest;
import com.creativeai.auth.dto.gmail.GmailStatusDto;
import com.creativeai.auth.security.JwtService;
import com.creativeai.auth.service.GmailOAuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Gmail OAuth2 endpoints.
 *
 * Public (no JWT required):
 *   GET  /gmail/auth/url        → Returns Google authorization URL
 *   GET  /gmail/callback        → Handles OAuth2 redirect from Google
 *
 * Protected (JWT required via Authorization: Bearer <token>):
 *   GET  /gmail/status          → Is the user connected to Gmail?
 *   GET  /gmail/emails          → Fetch inbox emails
 *   GET  /gmail/emails/{id}     → Get a specific email
 *   POST /gmail/emails/send     → Send an email
 *   POST /gmail/emails/{id}/read → Mark email as read
 *   DELETE /gmail/disconnect    → Revoke Gmail access
 */
@Slf4j
@RestController
@RequestMapping("/gmail")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GmailController {

    private final GmailOAuthService gmailService;
    private final JwtService jwtService;

    // ── Public ────────────────────────────────────────────────────────────────

    /** Step 1: Frontend calls this to get the Google consent URL */
    @GetMapping("/auth/url")
    public ResponseEntity<Map<String, String>> getAuthUrl(@RequestParam String userId) {
        String url = gmailService.buildAuthorizationUrl(userId);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * Step 2: Google redirects here after user grants permission.
     * Exchanges the code for tokens, saves them, redirects to frontend.
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam String code,
                                         @RequestParam String state) {
        String redirectUrl = gmailService.handleCallback(code, state);
        return ResponseEntity.status(302).location(URI.create(redirectUrl)).build();
    }

    // ── Protected ─────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<GmailStatusDto> getStatus(HttpServletRequest request) {
        String userId = extractUserId(request);
        log.info("[GMAIL] GET /gmail/status userId={}", userId);
        GmailStatusDto status = gmailService.getStatus(userId);
        log.info("[GMAIL] status result: connected={} email={}", status.connected(), status.gmailEmail());
        return ResponseEntity.ok(status);
    }

    @GetMapping("/emails")
    public ResponseEntity<List<GmailEmailDto>> listEmails(
            HttpServletRequest request,
            @RequestParam(defaultValue = "20") int maxResults,
            @RequestParam(defaultValue = "INBOX") String labelId,
            @RequestParam(required = false) String pageToken) {
        String userId = extractUserId(request);
        log.info("[GMAIL] GET /gmail/emails userId={} maxResults={} label={}", userId, maxResults, labelId);
        try {
            List<GmailEmailDto> emails = gmailService.listEmails(userId, maxResults, labelId, pageToken);
            log.info("[GMAIL] listEmails returned {} emails", emails.size());
            return ResponseEntity.ok(emails);
        } catch (Exception e) {
            log.error("[GMAIL] listEmails FAILED: {}", e.getMessage(), e);
            throw e;
        }
    }

    @GetMapping("/emails/{messageId}")
    public ResponseEntity<GmailEmailDto> getEmail(HttpServletRequest request,
                                                   @PathVariable String messageId) {
        String userId = extractUserId(request);
        return ResponseEntity.ok(gmailService.getEmailDetail(userId, messageId));
    }

    @PostMapping("/emails/send")
    public ResponseEntity<Void> sendEmail(HttpServletRequest request,
                                          @RequestBody GmailSendRequest req) {
        String userId = extractUserId(request);
        gmailService.sendEmail(userId, req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/emails/{messageId}/read")
    public ResponseEntity<Void> markRead(HttpServletRequest request,
                                         @PathVariable String messageId) {
        String userId = extractUserId(request);
        gmailService.markEmailRead(userId, messageId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(HttpServletRequest request) {
        String userId = extractUserId(request);
        gmailService.disconnect(userId);
        return ResponseEntity.ok().build();
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String extractUserId(HttpServletRequest request) {
        // Prefer SecurityContext (already validated by JWT filter — covers both header and cookie auth)
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            return auth.getName();
        }
        // Fallback: read JWT from Authorization header directly
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return jwtService.extractUsername(header.substring(7));
        }
        throw new IllegalArgumentException("Not authenticated");
    }
}
