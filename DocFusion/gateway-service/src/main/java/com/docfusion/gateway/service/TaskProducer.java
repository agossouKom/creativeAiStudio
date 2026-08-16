package com.docfusion.gateway.service;

import com.docfusion.gateway.security.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskProducer {

    private final RabbitTemplate rabbitTemplate;

    public void sendOcrTask(String fileName, String bucketName) {
        Map<String, String> message = Map.of(
                "fileName", fileName,
                "bucketName", bucketName,
                "taskType", "OCR"
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.OCR_ROUTING_KEY,
                message
        );
        System.out.println(" [x] Sent OCR task for: " + fileName);
    }
}
