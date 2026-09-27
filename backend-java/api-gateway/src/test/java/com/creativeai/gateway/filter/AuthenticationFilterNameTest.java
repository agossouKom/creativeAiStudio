package com.creativeai.gateway.filter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.factory.GatewayFilterFactory;
import org.springframework.stereotype.Component;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Le nom utilisé dans les routes n'est pas le nom de la classe, et il ne se
 * devine pas : ici la classe appelle super(Config.class), et le nom vient de
 * NameUtils.normalizeFilterFactoryName. « Authentication » et
 * « AuthenticationFilter » ne sont pas interchangeables, et l'erreur
 * « Unable to find GatewayFilterFactory with name X » ne dit pas quel nom
 * aurait été le bon. Ce test fige le nom réel.
 */
class AuthenticationFilterNameTest {

    @Test
    @DisplayName("le nom de la fabrique est « AuthenticationFilter »")
    void nomReel() {
        // JwtUtil n'est utilisé que dans apply() : name() en est indépendant.
        assertEquals("AuthenticationFilter", new AuthenticationFilter(null).name());
    }

    @Test
    @DisplayName("la classe est un composant instancié par le scan de la gateway")
    void beanDeComposant() {
        assertTrue(GatewayFilterFactory.class.isAssignableFrom(AuthenticationFilter.class),
            "AuthenticationFilter doit hériter d'une fabrique de filtre");
        assertTrue(AuthenticationFilter.class.isAnnotationPresent(Component.class),
            "sans @Component, aucune route ne peut utiliser cette fabrique");
    }
}
