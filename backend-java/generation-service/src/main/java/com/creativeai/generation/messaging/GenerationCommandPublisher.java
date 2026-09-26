package com.creativeai.generation.messaging;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * Publie les commandes de génération sur les topics d'entrée des workers.
 */
@Slf4j
@Component
public class GenerationCommandPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final String videoInputTopic;
    private final String imageInputTopic;

    public GenerationCommandPublisher(KafkaTemplate<String, String> kafkaTemplate,
                                     @Value("${generation.video.input-topic}") String videoInputTopic,
                                     @Value("${generation.image.input-topic}") String imageInputTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.videoInputTopic = videoInputTopic;
        this.imageInputTopic = imageInputTopic;
    }

    public void publishVideo(String jobId, String payload) {
        send(videoInputTopic, jobId, payload);
    }

    public void publishImage(String jobId, String payload) {
        send(imageInputTopic, jobId, payload);
    }

    private void send(String topic, String jobId, String payload) {
        try {
            kafkaTemplate.send(topic, jobId, payload).get(15, TimeUnit.SECONDS);
            log.info("Commande de génération publiée sur {} pour le job {}", topic, jobId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Envoi de la commande interrompu pour le job " + jobId, e);
        } catch (Exception e) {
            throw new IllegalStateException("Envoi de la commande impossible sur " + topic
                + " pour le job " + jobId + ": " + e.getMessage(), e);
        }
    }
}
