package com.creativeai.telegram;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class TelegramMcpApplication {

    public static void main(String[] args) {
        SpringApplication.run(TelegramMcpApplication.class, args);
    }
}
