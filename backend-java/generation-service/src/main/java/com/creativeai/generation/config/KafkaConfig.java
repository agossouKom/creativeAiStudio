package com.creativeai.generation.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;

    @Value("${generation.video.input-topic}")
    private String videoInputTopic;

    @Value("${generation.video.result-topic}")
    private String videoResultTopic;

    @Value("${generation.image.input-topic}")
    private String imageInputTopic;

    @Value("${generation.image.result-topic}")
    private String imageResultTopic;

    @Bean
    public ProducerFactory<String, String> producerFactory() {
        return new org.springframework.kafka.core.DefaultKafkaProducerFactory<>(Map.of(
            "bootstrap.servers", bootstrapServers,
            "key.serializer", StringSerializer.class.getName(),
            "value.serializer", StringSerializer.class.getName(),
            "acks", "all",
            "retries", "3",
            "max.in.flight.requests.per.connection", "1"
        ));
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }

    @Bean
    public ConsumerFactory<String, String> consumerFactory() {
        return new DefaultKafkaConsumerFactory<>(Map.of(
            "bootstrap.servers", bootstrapServers,
            "group.id", groupId,
            "key.deserializer", StringDeserializer.class.getName(),
            "value.deserializer", StringDeserializer.class.getName(),
            "auto.offset.reset", "earliest",
            "enable.auto.commit", "false"
        ));
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
        ConsumerFactory<String, String> consumerFactory, KafkaTemplate<String, String> kafkaTemplate) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumerFactory);
        factory.setConcurrency(2);
        factory.getContainerProperties().setPollTimeout(3000);

        // Un message de résultat illisible part en DLQ après 3 tentatives, sans bloquer la partition.
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
            kafkaTemplate, (record, ex) -> new TopicPartition(record.topic() + ".dlq", 0));
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, new FixedBackOff(2000L, 3));
        errorHandler.addNotRetryableExceptions(DeserializationException.class, SerializationException.class);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }

    @Bean
    public NewTopic videoInputTopic() {
        return TopicBuilder.name(videoInputTopic).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic videoResultTopic() {
        return TopicBuilder.name(videoResultTopic).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic imageInputTopic() {
        return TopicBuilder.name(imageInputTopic).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic imageResultTopic() {
        return TopicBuilder.name(imageResultTopic).partitions(3).replicas(1).build();
    }

    // Dead-letter topics : conservés 7 jours pour analyse post-mortem,
    // comme les .dlq du reste de la stack.
    @Bean
    public NewTopic videoResultDlqTopic() {
        return deadLetterTopic(videoResultTopic);
    }

    @Bean
    public NewTopic imageResultDlqTopic() {
        return deadLetterTopic(imageResultTopic);
    }

    private static NewTopic deadLetterTopic(String resultTopic) {
        return TopicBuilder.name(resultTopic + ".dlq")
            .partitions(3)
            .replicas(1)
            .config("retention.ms", "604800000")
            .build();
    }
}
