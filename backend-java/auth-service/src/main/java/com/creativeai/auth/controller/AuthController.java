package com.creativeai.auth.controller;

import com.creativeai.auth.dto.AuthResponse;
import com.creativeai.auth.dto.GoogleLoginRequest;
import com.creativeai.auth.dto.LoginOtpRequest;
import com.creativeai.auth.dto.LoginRequest;
import com.creativeai.auth.dto.RegisterRequest;
import com.creativeai.auth.repository.UserRepository;
import com.creativeai.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService    authService;
    private final UserRepository userRepository;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.ok(Map.of("message", "Inscription initiée. Veuillez vérifier votre email pour le code OTP."));
    }

    @PostMapping("/register/verify")
    public ResponseEntity<AuthResponse> verifyRegistration(@RequestParam String email, @RequestParam String code, HttpServletResponse response) {
        AuthResponse authResponse = authService.verifyRegistration(email, code);
        setCookie(response, authResponse.accessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        setCookie(response, authResponse.accessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/otp/send")
    public ResponseEntity<Map<String, String>> sendOtp(@RequestParam String email) {
        authService.requestLoginOtp(email);
        return ResponseEntity.ok(Map.of("message", "OTP envoyé avec succès à " + email));
    }

    @PostMapping("/otp/login")
    public ResponseEntity<AuthResponse> loginWithOtp(@Valid @RequestBody LoginOtpRequest req, HttpServletResponse response) {
        AuthResponse authResponse = authService.loginWithOtp(req);
        setCookie(response, authResponse.accessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@Valid @RequestBody GoogleLoginRequest req, HttpServletResponse response) {
        AuthResponse authResponse = authService.loginWithGoogle(req.token());
        setCookie(response, authResponse.accessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("accessToken", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in production with HTTPS
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Déconnecté avec succès"));
    }

    private void setCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("accessToken", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in production with HTTPS
        cookie.setPath("/");
        cookie.setMaxAge(86400); // 1 day
        response.addCookie(cookie);
    }

    private AuthResponse cleanResponse(AuthResponse res) {
        return new AuthResponse(
                null, // Remove token from body
                res.tokenType(),
                res.userId(),
                res.email(),
                res.fullName(),
                res.role(),
                res.abonnement(),
                res.credits()
        );
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Auth Service is running");
    }

    @GetMapping("/check-email")
    public ResponseEntity<Map<String, Object>> checkEmail(@RequestParam String email) {
        boolean exists = userRepository.findByEmail(email.trim().toLowerCase())
                .map(u -> u.isEnabled())
                .orElse(false);
        return ResponseEntity.ok(Map.of("exists", exists, "email", email.trim().toLowerCase()));
    }
}
