package com.docfusion.gateway.service;

import com.docfusion.gateway.security.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResultConsumer {

    private final SimpMessagingTemplate messagingTemplate;

    @RabbitListener(queues = RabbitMQConfig.RESULTS_QUEUE)
    public void consumeResult(Map<String, Object> result) {
        System.out.println(" [v] Received OCR result for: " + result.get("fileName"));
        
        // Broadcast to WebSockets
        // In a real SaaS, we would use a specific user destination like /topic/results/{userId}
        messagingTemplate.convertAndSend("/topic/results", (Object) result);
    }
}
