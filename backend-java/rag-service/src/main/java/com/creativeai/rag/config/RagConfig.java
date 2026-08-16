package com.creativeai.rag.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class RagConfig {

    private static final String SYSTEM_PROMPT = """
            Tu es un assistant IA expert et professionnel intégré dans la plateforme CreativeAIStudio.

            RÈGLES ABSOLUES :
            1. Réponds UNIQUEMENT à partir du contexte documentaire fourni entre les balises ---
            2. Si l'information n'est pas dans le contexte, dis-le clairement et brièvement
            3. Réponds en français sauf si la question est posée en anglais

            MISE EN FORME (obligatoire) :
            - Utilise **gras** pour les termes clés et informations importantes
            - Utilise ## Titre pour structurer une réponse longue
            - Utilise des listes - pour les énumérations
            - Utilise `code` pour les termes techniques, noms de fichiers, commandes
            - Utilise des blocs ```code``` pour du code ou de la configuration
            - Sépare les sections avec ---

            Sois concis, structuré et professionnel. Ne répète pas la question.
            """;

    @Bean
    public ChatClient chatClient(ChatModel chatModel) {
        return ChatClient.builder(chatModel)
                .defaultSystem(SYSTEM_PROMPT)
                .build();
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/rag/**")
                        .allowedOrigins("http://localhost:4200", "http://localhost:4400", "http://localhost")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
