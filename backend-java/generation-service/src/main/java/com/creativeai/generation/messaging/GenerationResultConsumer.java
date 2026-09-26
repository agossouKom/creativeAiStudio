package com.creativeai.generation.messaging;

import com.creativeai.generation.service.GenerationResultService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consomme les topics de résultats des workers vidéo et image.
 * Les événements illisibles partent en DLQ (voir KafkaConfig) au lieu de
 * bloquer la partition.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GenerationResultConsumer {

    private final GenerationResultService resultService;

    @KafkaListener(
        topics = {"${generation.video.result-topic}", "${generation.image.result-topic}"},
        groupId = "${spring.kafka.consumer.group-id}")
    public void onResult(String payload) {
        resultService.apply(payload);
    }
}
