package com.creativeai.generation.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Catalogue des modeles d'image que le Studio peut proposer.
 *
 * Le champ `model` de ImageOptionsRequest est un texte libre : sans ce
 * catalogue, un utilisateur peut taper n'importe quelle chaine, et le worker
 * la transmet telle quelle au provider. Le provider repond alors 400, ou pire,
 * renvoie silencieusement un autre modele. Le menu deroulant du Studio a
 * besoin d'une liste fermee, et l'API doit refuser ce qui n'y figure pas.
 */
@Service
public class ImageModelCatalog {

    /** Libelle utilisateur : jamais de nom de fournisseur dans l'UI. */
    public record ImageModel(
            String id,
            String label,
            String description,
            int defaultSize,
            boolean available,
            String unavailableReason
    ) {
    }

    private record Entry(String id, String label, String description, int defaultSize) {
    }

    private static final List<Entry> ENTRIES = List.of(
            new Entry("gpt-image-1", "Qualite maximale", "Le plus fidele aux indications, ideal pour une image de couverture.", 1024),
            new Entry("dall-e-3", "Style illustre", "Rendu graphique/net, bon pour les visuels de marque.", 1024),
            new Entry("dall-e-2", "Rapide et econome", "Generation simple, utile pour les brouillons.", 512)
    );

    private final boolean providerConfigured;

    public ImageModelCatalog(
            @Value("${generation.image-provider-configured:false}") boolean providerConfigured) {
        this.providerConfigured = providerConfigured;
    }

    public List<ImageModel> list() {
        return ENTRIES.stream()
                .map(entry -> new ImageModel(
                        entry.id(),
                        entry.label(),
                        entry.description(),
                        entry.defaultSize(),
                        providerConfigured,
                        providerConfigured ? null
                                : "Aucun service de generation d'images n'est configure. "
                                + "Les images ne sont pas disponibles pour le moment."))
                .toList();
    }

    public Optional<ImageModel> find(String modelId) {
        if (modelId == null || modelId.isBlank()) {
            return Optional.empty();
        }
        return list().stream().filter(m -> m.id().equals(modelId.trim())).findFirst();
    }

    /**
     * @return le modele demande, ou le modele par defaut si aucun n'est fourni
     * @throws IllegalArgumentException si le modele demande n'est pas au catalogue
     */
    public String resolveOrDefault(String requestedModel) {
        if (requestedModel == null || requestedModel.isBlank()) {
            return ENTRIES.get(0).id();
        }
        String trimmed = requestedModel.trim();
        if (find(trimmed).isEmpty()) {
            String allowed = ENTRIES.stream().map(Entry::id).reduce((a, b) -> a + ", " + b).orElse("");
            throw new IllegalArgumentException(
                    "model doit faire partie de : " + allowed);
        }
        return trimmed;
    }
}
