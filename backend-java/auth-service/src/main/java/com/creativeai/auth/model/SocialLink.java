package com.creativeai.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * SocialLink entity representing a social media profile link
 */
@Entity
@Table(name = "social_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SocialLink extends BaseEntity {

    @NotBlank
    @Size(min = 2, max = 100)
    @Column(nullable = false, length = 100)
    private String platform; // e.g., "Facebook", "TikTok"

    @NotBlank
    @Size(max = 500)
    @Column(nullable = false, length = 500)
    private String url; // e.g., "https://tiktok.com/@shopyapp"

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String iconClass; // e.g., "fa-brands fa-tiktok"

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OwnerType ownerType;

    public enum OwnerType {
        US, CLIENT
    }
}
