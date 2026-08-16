package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.UserUpdateRequest;
import com.creativeai.auth.dto.response.UserResponse;
import com.creativeai.auth.model.User;
import com.creativeai.auth.model.UserSession;
import com.creativeai.auth.repository.UserRepository;
import com.creativeai.auth.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

/**
 * Service pour la gestion administrative des utilisateurs.
 * Gère la logique métier liée au soft-delete, à la restauration et à la révocation des sessions.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final UserSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Recherche les utilisateurs selon leur état de suppression.
     */
    @Transactional(readOnly = true)
    public List<UserResponse> findAll(Boolean deleted) {
        if (deleted == null) {
            return userRepository.findAll().stream().map(this::toResponse).toList();
        }
        if (deleted) return userRepository.findByDeletedTrue().stream().map(this::toResponse).toList();
        return userRepository.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    /**
     * Récupère un utilisateur actif par son ID.
     */
    @Transactional(readOnly = true)
    public UserResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    /**
     * Crée un nouvel utilisateur.
     */
    public UserResponse create(com.creativeai.auth.dto.request.UserCreateRequest req) {
        if (userRepository.findByEmail(req.email()).isPresent()) {
            throw new IllegalArgumentException("Cet email est déjà utilisé.");
        }
        User user = User.builder()
                .email(req.email())
                .fullName(req.fullName())
                .role(com.creativeai.auth.model.enums.Role.valueOf(req.role()))
                .abonnement(req.abonnement() != null ? com.creativeai.auth.model.enums.Abonnement.valueOf(req.abonnement()) : com.creativeai.auth.model.enums.Abonnement.FREE)
                .credits(req.credits() != null ? req.credits() : 0)
                .enabled(req.enabled() != null ? req.enabled() : true)
                .password(req.password() != null && !req.password().isBlank() ? passwordEncoder.encode(req.password()) : passwordEncoder.encode("defaultPassword123"))
                .deleted(false)
                .build();
        return toResponse(userRepository.save(user));
    }

    /**
     * Met à jour les informations d'un utilisateur.
     */
    public UserResponse update(String id, UserUpdateRequest req) {
        User user = getOrThrow(id);
        if (req.fullName() != null) user.setFullName(req.fullName());
        if (req.role() != null) user.setRole(req.role());
        if (req.abonnement() != null) user.setAbonnement(req.abonnement());
        if (req.credits() != null) user.setCredits(req.credits());
        if (req.enabled() != null) user.setEnabled(req.enabled());
        return toResponse(userRepository.save(user));
    }

    /**
     * Supprime logiquement un utilisateur et révoque ses sessions.
     */
    public void delete(String id) {
        User user = getOrThrow(id);
        user.setDeleted(true);
        user.setEnabled(false);
        userRepository.save(user);
        revokeAllSessions(id);
    }

    /**
     * Restaure un utilisateur supprimé.
     */
    public UserResponse restore(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));
        user.setDeleted(false);
        user.setEnabled(true);
        return toResponse(userRepository.save(user));
    }

    /**
     * Révoque toutes les sessions actives d'un utilisateur (DB + JWT).
     */
    public void revokeAllSessions(String userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.setRevocationTimestamp(System.currentTimeMillis());
            userRepository.save(user);
        }

        List<UserSession> sessions = sessionRepository.findByUserIdAndRevokedFalse(userId);
        sessions.forEach(UserSession::revoke);
        sessionRepository.saveAll(sessions);
    }

    /**
     * Récupère toutes les sessions (actives et inactives).
     */
    @Transactional(readOnly = true)
    public List<com.creativeai.auth.dto.response.UserSessionResponse> findAllSessions() {
        return sessionRepository.findAll().stream().map(s -> new com.creativeai.auth.dto.response.UserSessionResponse(
                s.getId(),
                s.getUser() != null ? s.getUser().getId() : null,
                s.getUser() != null ? s.getUser().getEmail() : null,
                s.getIpAddress(),
                s.getUserAgent(),
                s.getDeviceType(),
                s.getAccessTokenExpiresAt(),
                s.isRevoked(),
                s.getLastAccessedAt(),
                s.getCreatedAt()
        )).toList();
    }

    /**
     * Révoque une session spécifique (par ID de session).
     */
    public void revokeSession(String sessionId) {
        UserSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable : " + sessionId));
        session.revoke();
        sessionRepository.save(session);
    }

    private User getOrThrow(String id) {
        return userRepository.findById(id).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));
    }

    public UserResponse toResponse(User u) {
        return new UserResponse(
                u.getId(), u.getEmail(), u.getFullName(), u.getRole(),
                u.getAbonnement(), u.getCredits(), u.isEnabled(), u.isDeleted(),
                u.getCreatedAt(), u.getUpdatedAt()
        );
    }
}
