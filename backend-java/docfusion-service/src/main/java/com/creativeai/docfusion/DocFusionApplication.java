package com.creativeai.docfusion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class DocFusionApplication {
    public static void main(String[] args) {
        SpringApplication.run(DocFusionApplication.class, args);
    }
}
