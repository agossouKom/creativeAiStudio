package com.creativeai.search.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * Retry + Dead Letter Queue pour les consumers Kafka du search-service.
 *
 * Stratégie : 3 tentatives avec backoff exponentiel (1s → 2s → 4s),
 * puis publication du message original dans <topic>.dlq pour analyse post-mortem.
 * Les topics DLQ sont créés au démarrage par kafka-topics-init (docker-compose).
 */
@Slf4j
@Configuration
public class KafkaRetryConfig {

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<Object, Object> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
            kafkaTemplate,
            (ConsumerRecord<?, ?> record, Exception ex) -> {
                String dlqTopic = record.topic() + ".dlq";
                log.error("[KAFKA-DLQ] Message envoyé en DLQ={} après échec — offset={} key={} error={}",
                    dlqTopic, record.offset(), record.key(), ex.getMessage());
                return new TopicPartition(dlqTopic, 0);
            }
        );

        ExponentialBackOff backoff = new ExponentialBackOff(1_000L, 2.0);
        backoff.setMaxAttempts(3);
        backoff.setMaxInterval(10_000L);

        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backoff);
        handler.addNotRetryableExceptions(IllegalArgumentException.class);
        return handler;
    }
}
