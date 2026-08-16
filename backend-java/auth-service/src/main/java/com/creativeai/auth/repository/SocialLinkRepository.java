package com.creativeai.auth.repository;

import com.creativeai.auth.model.SocialLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SocialLinkRepository extends JpaRepository<SocialLink, String> {
    List<SocialLink> findByOwnerTypeOrderByDisplayOrderAsc(SocialLink.OwnerType ownerType);
    List<SocialLink> findByIsActiveTrueOrderByDisplayOrderAsc();
    List<SocialLink> findByOwnerTypeAndIsActiveTrueOrderByDisplayOrderAsc(SocialLink.OwnerType ownerType);
}
