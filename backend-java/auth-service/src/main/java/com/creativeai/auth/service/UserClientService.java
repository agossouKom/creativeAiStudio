package com.creativeai.auth.service;

import com.creativeai.auth.dto.UserClientDto;
import com.creativeai.auth.model.User;
import com.creativeai.auth.model.UserClient;
import com.creativeai.auth.repository.UserClientRepository;
import com.creativeai.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserClientService {

    private final UserClientRepository repo;
    private final UserRepository userRepo;

    public List<UserClientDto> list() {
        return repo.findByUserIdAndDeletedFalse(currentUser().getId()).stream().map(this::toDto).toList();
    }

    public List<UserClientDto> trash() {
        return repo.findByUserIdAndDeletedTrue(currentUser().getId()).stream().map(this::toDto).toList();
    }

    public UserClientDto create(UserClientDto dto) {
        User user = currentUser();
        UserClient c = UserClient.builder()
                .user(user).code(dto.code()).nom(dto.nom()).prenoms(dto.prenoms())
                .contact(dto.contact()).email(dto.email()).entrepriseName(dto.entrepriseName())
                .build();
        return toDto(repo.save(c));
    }

    public UserClientDto update(String id, UserClientDto dto) {
        UserClient c = get(id);
        c.setCode(dto.code()); c.setNom(dto.nom()); c.setPrenoms(dto.prenoms());
        c.setContact(dto.contact()); c.setEmail(dto.email()); c.setEntrepriseName(dto.entrepriseName());
        return toDto(repo.save(c));
    }

    public void softDelete(String id) {
        UserClient c = get(id);
        c.setDeleted(true);
        repo.save(c);
    }

    public UserClientDto restore(String id) {
        UserClient c = get(id);
        c.setDeleted(false);
        return toDto(repo.save(c));
    }

    public void hardDelete(String id) {
        repo.delete(get(id));
    }

    public void emptyTrash() {
        repo.deleteAll(repo.findByUserIdAndDeletedTrue(currentUser().getId()));
    }

    private UserClient get(String id) {
        String userId = currentUser().getId();
        return repo.findById(id)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> new IllegalArgumentException("Client introuvable : " + id));
    }

    private UserClientDto toDto(UserClient c) {
        return new UserClientDto(c.getId(), c.getCode(), c.getNom(), c.getPrenoms(),
                c.getContact(), c.getEmail(), c.getEntrepriseName(), c.isDeleted());
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email).orElseThrow();
    }
}
