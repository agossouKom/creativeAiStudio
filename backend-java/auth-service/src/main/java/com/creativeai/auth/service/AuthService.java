package com.creativeai.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.creativeai.auth.dto.AuthResponse;
import com.creativeai.auth.dto.LoginOtpRequest;
import com.creativeai.auth.dto.LoginRequest;
import com.creativeai.auth.dto.RegisterRequest;
import com.creativeai.auth.model.User;
import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.Role;
import com.creativeai.auth.repository.UserRepository;
import com.creativeai.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final OtpService otpService;
    private final com.creativeai.auth.repository.UserSessionRepository sessionRepository;

    private static final String GOOGLE_CLIENT_ID = "VOTRE_CLIENT_ID_GOOGLE.apps.googleusercontent.com";

    public void register(RegisterRequest req) {
        if (!req.password().equals(req.confirmPassword())) {
            throw new IllegalArgumentException("Les mots de passe ne correspondent pas.");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Cet email est déjà utilisé.");
        }

        User user = User.builder()
                .fullName(req.fullName())
                .email(req.email())
                .password(passwordEncoder.encode(req.password()))
                .role(Role.USER)
                .abonnement(Abonnement.FREE)
                .credits(50)
                .enabled(false) // Needs verification
                .build();

        userRepository.save(user);
        otpService.sendOtp(user.getEmail(), "REGISTRATION");
    }

    public AuthResponse verifyRegistration(String email, String code) {
        if (!otpService.verifyOtp(email, code)) {
            throw new IllegalArgumentException("Code OTP invalide ou expiré.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur non trouvé."));
        user.setEnabled(true);
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email(), req.password())
            );
        } catch (Exception e) {
            throw new BadCredentialsException("Email ou mot de passe incorrect.");
        }

        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new BadCredentialsException("Utilisateur introuvable."));

        return buildAuthResponse(user);
    }

    public void requestLoginOtp(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Utilisateur introuvable."));
        otpService.sendOtp(email, "LOGIN");
    }

    public AuthResponse loginWithOtp(LoginOtpRequest req) {
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email(), req.password())
            );
        } catch (Exception e) {
            throw new BadCredentialsException("Email ou mot de passe incorrect.");
        }

        if (!otpService.verifyOtp(req.email(), req.otpCode())) {
            throw new BadCredentialsException("Code OTP invalide ou expiré.");
        }

        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new BadCredentialsException("Utilisateur introuvable."));

        return buildAuthResponse(user);
    }

    public AuthResponse loginWithGoogle(String idTokenString) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(GOOGLE_CLIENT_ID))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                throw new BadCredentialsException("Jeton Google invalide.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String name = (String) payload.get("name");

            User user = userRepository.findByEmail(email)
                    .orElseGet(() -> {
                        User newUser = User.builder()
                                .email(email)
                                .fullName(name)
                                .password(passwordEncoder.encode("OAUTH_USER_" + email))
                                .role(Role.USER)
                .abonnement(Abonnement.FREE)
                                .credits(50)
                                .enabled(true)
                                .build();
                        return userRepository.save(newUser);
                    });

            if (!user.isEnabled()) {
                user.setEnabled(true);
                userRepository.save(user);
            }

            return buildAuthResponse(user);
        } catch (Exception e) {
            throw new BadCredentialsException("Erreur authentification Google : " + e.getMessage());
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        Map<String, Object> claims = Map.of(
                "role", user.getRole().name(),
                "abonnement", user.getAbonnement().name(),
                "credits", user.getCredits(),
                "fullName", user.getFullName()
        );
        String token = jwtService.generateToken(user, claims);

        String ipAddress = "N/A";
        String userAgent = "N/A";
        try {
            org.springframework.web.context.request.ServletRequestAttributes attrs = 
                (org.springframework.web.context.request.ServletRequestAttributes) org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                jakarta.servlet.http.HttpServletRequest request = attrs.getRequest();
                ipAddress = request.getRemoteAddr();
                userAgent = request.getHeader("User-Agent");
            }
        } catch (Exception e) {}

        com.creativeai.auth.model.UserSession session = com.creativeai.auth.model.UserSession.builder()
                .user(user)
                .accessToken(token)
                .accessTokenExpiresAt(java.time.LocalDateTime.now().plusHours(24))
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .deviceType("Web")
                .revoked(false)
                .lastAccessedAt(java.time.LocalDateTime.now())
                .build();
        sessionRepository.save(session);

        return new AuthResponse(
                token, "Bearer",
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getAbonnement().name(),
                user.getCredits()
        );
    }
}
