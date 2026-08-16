package com.creativeai.auth.service;

import com.creativeai.auth.dto.UserProductDto;
import com.creativeai.auth.model.User;
import com.creativeai.auth.model.UserProduct;
import com.creativeai.auth.repository.UserProductRepository;
import com.creativeai.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserProductService {

    private final UserProductRepository repo;
    private final UserRepository userRepo;

    public List<UserProductDto> list() {
        return repo.findByUserIdAndDeletedFalse(currentUser().getId()).stream().map(this::toDto).toList();
    }

    public List<UserProductDto> trash() {
        return repo.findByUserIdAndDeletedTrue(currentUser().getId()).stream().map(this::toDto).toList();
    }

    public UserProductDto create(UserProductDto dto) {
        User user = currentUser();
        UserProduct p = UserProduct.builder()
                .user(user).code(dto.code()).nom(dto.nom()).description(dto.description())
                .prix(dto.prix()).prixPromo(dto.prixPromo())
                .variantes(dto.variantes()).mentions(dto.mentions())
                .photos(dto.photos()).videos(dto.videos())
                .build();
        return toDto(repo.save(p));
    }

    public UserProductDto update(String id, UserProductDto dto) {
        UserProduct p = get(id);
        p.setCode(dto.code()); p.setNom(dto.nom()); p.setDescription(dto.description());
        p.setPrix(dto.prix()); p.setPrixPromo(dto.prixPromo());
        p.setVariantes(dto.variantes()); p.setMentions(dto.mentions());
        p.setPhotos(dto.photos()); p.setVideos(dto.videos());
        return toDto(repo.save(p));
    }

    public void softDelete(String id) {
        UserProduct p = get(id);
        p.setDeleted(true);
        repo.save(p);
    }

    public UserProductDto restore(String id) {
        UserProduct p = get(id);
        p.setDeleted(false);
        return toDto(repo.save(p));
    }

    public void hardDelete(String id) {
        repo.delete(get(id));
    }

    public void emptyTrash() {
        repo.deleteAll(repo.findByUserIdAndDeletedTrue(currentUser().getId()));
    }

    public UserProductDto findByCode(String code) {
        String userId = currentUser().getId();
        return repo.findByCodeAndUserIdAndDeletedFalse(code, userId)
                .map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable (code=" + code + ")"));
    }

    private UserProduct get(String id) {
        String userId = currentUser().getId();
        return repo.findById(id)
                .filter(p -> p.getUser().getId().equals(userId))
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable : " + id));
    }

    private UserProductDto toDto(UserProduct p) {
        return new UserProductDto(p.getId(), p.getCode(), p.getNom(), p.getDescription(),
                p.getPrix(), p.getPrixPromo(), p.getVariantes(), p.getMentions(),
                p.getPhotos(), p.getVideos(), p.isDeleted());
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email).orElseThrow();
    }
}
