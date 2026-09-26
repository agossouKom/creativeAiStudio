package com.creativeai.generation.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI generationApi() {
        return new OpenAPI().info(new Info()
            .title("Creative AI Studio - Generation Service")
            .description("Orchestration des générations vidéo et image, et publication sociale "
                + "(Facebook / Instagram natifs, autres plateformes déclarées non disponibles).")
            .version("1.0.0"));
    }
}
