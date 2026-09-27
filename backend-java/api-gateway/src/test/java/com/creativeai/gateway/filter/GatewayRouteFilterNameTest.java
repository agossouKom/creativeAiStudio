package com.creativeai.gateway.filter;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.cloud.gateway.filter.factory.GatewayFilterFactory;
import org.springframework.cloud.gateway.support.NameUtils;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.yaml.snakeyaml.Yaml;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Les fabriques de filtres sont résolues par le nom que Spring dérive de la
 * classe, pas par le nom de la classe. Un nom erroné dans application.yml ne
 * produit qu'un échec au démarrage du conteneur (« Unable to find
 * GatewayFilterFactory with name … »), qui annule le contexte applicatif et
 * met toute l'API en 502 : invisible pour un test unitaire, qui appelle
 * directement la fabrique. Ce test compare les noms écrits dans le yml aux
 * noms réels des classes du projet.
 */
class GatewayRouteFilterNameTest {

    private static final String FILTER_PACKAGE = "com.creativeai.gateway.filter";

    @Test
    @DisplayName("les noms de filtres du yml correspondent aux fabriques du projet")
    void nomsDeFiltresValides() throws Exception {
        Set<String> nomsReels = nomsDesFabriquesDuProjet();

        assertTrue(nomsReels.contains("AuthenticationFilter"),
            "le scan n'a pas trouvé AuthenticationFilter, ce test ne protège rien : " + nomsReels);

        List<String> invalides = new ArrayList<>();
        for (String nom : nomsDeFiltresUtilisesParLesRoutes()) {
            // Seules les fabriques de ce projet sont vérifiées : celles de
            // Spring Cloud Gateway (RequestSize, RewritePath…) sont hors de
            // portée du scan ci-dessus.
            if (correspondAUneFabriqueDuProjet(nom, nomsReels) && !nomsReels.contains(nom)) {
                invalides.add(nom);
            }
        }

        if (!invalides.isEmpty()) {
            fail("Noms de filtres invalides dans application.yml : " + invalides
                + " — seules ces fabriques existent : " + nomsReels);
        }
    }

    @Test
    @DisplayName("chaque route protégée utilise bien AuthenticationFilter")
    void routesProtegeesNommes() throws Exception {
        List<String> routesAttendues = List.of(
            "audio-ai", "video-ai", "face-ai", "docfusion-service",
            "rag-service", "generation-service", "media-upload",
            "oauth-social-authorize", "file-security");

        String yml = lireApplicationYml();
        List<String> manquantes = new ArrayList<>();
        for (String route : routesAttendues) {
            if (!routeUtiliseAuthenticationFilter(yml, route)) {
                manquantes.add(route);
            }
        }
        if (!manquantes.isEmpty()) {
            fail("routes attendues sans AuthenticationFilter : " + manquantes);
        }
    }

    @Test
    @DisplayName("aucune route ne référence un nom de filtre d'authentification inventé")
    void pasDeNomInvente() throws Exception {
        for (String nom : nomsDeFiltresUtilisesParLesRoutes()) {
            if (nom.toLowerCase().startsWith("auth") && !nom.equals("AuthenticationFilter")) {
                fail("nom de filtre d'authentification inconnu : " + nom);
            }
        }
    }

    private boolean routeUtiliseAuthenticationFilter(String yml, String routeId) {
        int debut = yml.indexOf("- id: " + routeId);
        if (debut < 0) {
            return false;
        }
        int fin = yml.indexOf("- id:", debut + 1);
        String route = yml.substring(debut, fin < 0 ? yml.length() : fin);
        return route.contains("AuthenticationFilter");
    }

    private boolean correspondAUneFabriqueDuProjet(String nom, Set<String> nomsReels) {
        for (String reel : nomsReels) {
            if (nom.equalsIgnoreCase(reel)
                || nom.equalsIgnoreCase(reel + "Filter")
                || nom.equalsIgnoreCase(reel + "GatewayFilterFactory")) {
                return true;
            }
        }
        return false;
    }

    private Set<String> nomsDesFabriquesDuProjet() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner =
            new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AssignableTypeFilter(GatewayFilterFactory.class));

        Set<String> noms = new LinkedHashSet<>();
        for (BeanDefinition def : scanner.findCandidateComponents(FILTER_PACKAGE)) {
            noms.add(NameUtils.normalizeFilterFactoryName(fabriqueDe(def.getBeanClassName())));
        }
        return noms;
    }

    @SuppressWarnings("unchecked")
    private Class<? extends GatewayFilterFactory> fabriqueDe(String nomDeClasse) throws Exception {
        return (Class<? extends GatewayFilterFactory>) Class.forName(nomDeClasse);
    }

    private Set<String> nomsDeFiltresUtilisesParLesRoutes() throws Exception {
        Set<String> noms = new LinkedHashSet<>();
        Object routes = sousCle(lireYaml(), "spring", "cloud", "gateway", "routes");
        if (routes instanceof List<?> liste) {
            for (Object route : liste) {
                if (route instanceof Map<?, ?> r) {
                    ajouterNoms(r.get("filters"), noms);
                }
            }
        }
        return noms;
    }

    private Object sousCle(Map<String, Object> racine, String... chemin) {
        Object courant = racine;
        for (String cle : chemin) {
            if (!(courant instanceof Map<?, ?> map)) {
                return null;
            }
            courant = map.get(cle);
        }
        return courant;
    }

    private void ajouterNoms(Object filters, Set<String> cible) {
        if (!(filters instanceof List<?> liste)) {
            return;
        }
        for (Object filtre : liste) {
            if (filtre instanceof String s) {
                cible.add(s.split("=", 2)[0].trim());
            } else if (filtre instanceof Map<?, ?> m && m.get("name") != null) {
                cible.add(m.get("name").toString().trim());
            }
        }
    }

    private String lireApplicationYml() throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("application.yml")) {
            if (in == null) {
                fail("application.yml absent du classpath de test");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lireYaml() throws Exception {
        return (Map<String, Object>) new Yaml().load(lireApplicationYml());
    }
}
