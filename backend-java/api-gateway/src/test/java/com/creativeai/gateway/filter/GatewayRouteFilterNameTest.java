package com.creativeai.gateway.filter;

import java.io.InputStream;
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
 * Les fabriques de filtres déclarées dans application.yml sont résolues par
 * leur nom Spring, pas par leur nom de classe : AbstractGatewayFilterFactory
 * dérive ce nom via NameUtils.normalizeFilterFactoryName, qui retire le
 * suffixe « Filter ». Écrire « AuthenticationFilter » dans une route fait
 * donc échouer le démarrage de la gateway avec
 * « Unable to find GatewayFilterFactory with name Authentication » — et comme
 * le symptôme n'apparaît qu'au démarrage du conteneur, aucun test unitaire ne
 * le voit. Ce test verrouille le nom.
 */
class GatewayRouteFilterNameTest {

    private static final String FILTER_PACKAGE = "com.creativeai.gateway.filter";

    @Test
    @DisplayName("tous les noms de filtres des routes sont des noms de fabriques Spring valides")
    void nomsDeFiltresValides() throws Exception {
        Set<String> nomsReels = nomsDesFabriquesDuProjet();
        List<String> invalides = new ArrayList<>();

        for (String nom : nomsDeFiltresUtilisesParLesRoutes()) {
            // Seules les fabriques maison sont vérifiées : celles de Spring
            // Cloud Gateway (RequestSize, StripPrefix...) sont hors de portée.
            if (correspondAUneFabriqueDuProjet(nom, nomsReels) && !nomsReels.contains(nom)) {
                invalides.add(nom);
            }
        }

        if (!invalides.isEmpty()) {
            fail("Noms de filtres invalides dans application.yml : " + invalides
                + " — attendu " + nomsReels + " (le suffixe « Filter » est retiré par Spring)");
        }
        assertTrue(!nomsReels.isEmpty(), "aucune fabrique de filtre détectée, le test ne protège rien");
    }

    @Test
    @DisplayName("la route RAG est bien protégée par le filtre d'authentification")
    void routeRagProtegee() throws Exception {
        String yml = lireApplicationYml();
        int debut = yml.indexOf("- id: rag-service");
        assertTrue(debut > 0, "route rag-service absente d'application.yml");
        int fin = yml.indexOf("- id:", debut + 1);
        String route = yml.substring(debut, fin > 0 ? fin : yml.length());
        assertTrue(route.contains("- Authentication\n"),
            "la route rag-service doit garder le filtre Authentication (ingest/DELETE sans JWT)");
    }

    private boolean correspondAUneFabriqueDuProjet(String nom, Set<String> nomsReels) {
        for (String reel : nomsReels) {
            // « AuthenticationFilter » correspondrait à « Authentication » si on
            // réattachait le suffixe : c'est précisément l'erreur à attraper.
            if (nom.equalsIgnoreCase(reel) || nom.equalsIgnoreCase(reel + "Filter")
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
            return new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lireYaml() throws Exception {
        return (Map<String, Object>) new Yaml().load(lireApplicationYml());
    }
}
