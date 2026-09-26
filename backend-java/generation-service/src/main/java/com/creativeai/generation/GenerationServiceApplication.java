package com.creativeai.generation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GenerationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(GenerationServiceApplication.class, args);
    }
}
