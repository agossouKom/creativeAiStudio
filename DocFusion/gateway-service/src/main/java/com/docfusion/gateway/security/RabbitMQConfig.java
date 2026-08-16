package com.docfusion.gateway.security;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "docfusion.exchange";
    public static final String OCR_QUEUE = "ocr.queue";
    public static final String RESULTS_QUEUE = "results.queue";
    public static final String OCR_ROUTING_KEY = "document.ocr";

    @Bean
    public Queue ocrQueue() {
        return new Queue(OCR_QUEUE, true);
    }

    @Bean
    public Queue resultsQueue() {
        return new Queue(RESULTS_QUEUE, true);
    }

    @Bean
    public TopicExchange exchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Binding binding(Queue ocrQueue, TopicExchange exchange) {
        return BindingBuilder.bind(ocrQueue).to(exchange).with(OCR_ROUTING_KEY);
    }
}
