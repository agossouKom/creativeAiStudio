package com.creativeai.auth.dto;

import java.math.BigDecimal;

public record UserProductDto(
    String id,
    String code, String nom, String description,
    BigDecimal prix, BigDecimal prixPromo,
    String variantes, String mentions,
    String photos, String videos,
    boolean deleted
) {}
