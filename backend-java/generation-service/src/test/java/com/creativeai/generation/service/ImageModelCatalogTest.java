package com.creativeai.generation.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageModelCatalogTest {

    @Test
    @DisplayName("expose une liste fermee avec des libelles lisibles, sans nom de fournisseur")
    void listExposesUserFacingLabels() {
        var models = new ImageModelCatalog(true).list();
        assertThat(models).isNotEmpty();
        assertThat(models).allSatisfy(m -> {
            assertThat(m.id()).isNotBlank();
            assertThat(m.label()).isNotBlank();
            assertThat(m.defaultSize()).isBetween(64, 4096);
            assertThat(m.available()).isTrue();
        });
    }

    @Test
    @DisplayName("sans provider configure, les modeles sont marques indisponibles avec une raison")
    void marksUnavailableWithoutProvider() {
        var models = new ImageModelCatalog(false).list();
        assertThat(models).allSatisfy(m -> {
            assertThat(m.available()).isFalse();
            assertThat(m.unavailableReason()).contains("configure");
        });
    }

    @Test
    @DisplayName("un model absent du catalogue est refuse")
    void rejectsUnknownModel() {
        var catalog = new ImageModelCatalog(true);
        assertThatThrownBy(() -> catalog.resolveOrDefault("sk-not-a-real-model"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("model doit faire partie de");
    }

    @Test
    @DisplayName("un model du catalogue est accepte, et un model absent prend le defaut")
    void resolvesKnownAndDefaults() {
        var catalog = new ImageModelCatalog(true);
        var known = catalog.list().get(0).id();
        assertThat(catalog.resolveOrDefault(known)).isEqualTo(known);
        assertThat(catalog.resolveOrDefault("  " + known + "  ")).isEqualTo(known);
        assertThat(catalog.resolveOrDefault(null)).isEqualTo(known);
        assertThat(catalog.resolveOrDefault("")).isEqualTo(known);
    }
}
