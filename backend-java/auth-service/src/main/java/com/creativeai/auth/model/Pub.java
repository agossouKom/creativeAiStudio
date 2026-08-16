package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Advertising campaign – supports QUICK ADD (ClientPub can be created inline).
 */
@Entity
@Table(name = "pubs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Pub extends BaseEntity {

    @Column(nullable = false)
    private LocalDateTime debut;

    @Column(nullable = false)
    private LocalDateTime fin;

    /** List of image URLs for the campaign */
    @ElementCollection
    @CollectionTable(name = "pub_images", joinColumns = @JoinColumn(name = "pub_id"))
    @Column(name = "image_url", length = 1000)
    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_pub_id")
    private ClientPub clientPub;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    /** Duration of each ad display (seconds) */
    @Column(nullable = false)
    @Builder.Default
    private Integer duree = 30;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal prix;
}
