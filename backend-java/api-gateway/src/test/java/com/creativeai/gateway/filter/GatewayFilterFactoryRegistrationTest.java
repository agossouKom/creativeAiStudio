package com.creativeai.gateway.filter;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.filter.factory.GatewayFilterFactory;
import org.springframework.context.ApplicationContext;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Un filtre de route absent du contexte ne se voit qu'au démarrage du
 * conteneur : la résolution des routes annule alors le rafraîchissement du
 * contexte et la gateway boucle en crash-restart (« Unable to find
 * GatewayFilterFactory with name Authentication »), sans qu'aucune ligne de
 * log ne dise que le bean n'existe pas. Ce test monte le contexte et
 * interroge les beans.
 */
@SpringBootTest
class GatewayFilterFactoryRegistrationTest {

    @Autowired
    private ApplicationContext context;

    @Autowired
    private List<GatewayFilterFactory> filterFactories;

    @Test
    @DisplayName("le filtre d'authentification est bien un bean de fabrique de filtre")
    void authenticationFilterEstUnBean() {
        assertTrue(context.containsBean("authenticationFilter"),
            "le bean authenticationFilter est absent du contexte : "
                + "les beans com.creativeai.gateway.filter ne sont pas scannés");

        List<String> noms = filterFactories.stream()
            .map(GatewayFilterFactory::name)
            .collect(Collectors.toList());

        assertTrue(noms.contains("AuthenticationFilter"),
            "aucune fabrique nommée AuthenticationFilter parmi " + noms.size() + " fabriques");
    }

    @Test
    @DisplayName("les fabriques de base de la gateway sont présentes")
    void fabriquesDeBasePresentes() {
        List<String> noms = filterFactories.stream()
            .map(GatewayFilterFactory::name)
            .collect(Collectors.toList());

        assertTrue(noms.contains("RewritePath"), "RewritePath absent : " + noms);
        assertTrue(noms.size() > 5, "trop peu de fabriques de filtre : " + noms);
    }
}
