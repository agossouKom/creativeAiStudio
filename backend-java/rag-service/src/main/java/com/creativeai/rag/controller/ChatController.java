package com.creativeai.rag.controller;

import com.creativeai.rag.model.ChatMessage;
import com.creativeai.rag.model.ChatRequest;
import com.creativeai.rag.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/rag/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    /**
     * POST /rag/chat/stream — Server-Sent Events streaming endpoint.
     * Receives {question, conversationId?} and streams the AI response
     * token by token using SSE.
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody ChatRequest request) {
        log.debug("SSE stream request: question={}", request.question());
        SseEmitter emitter = new SseEmitter(120_000L); // 2-minute timeout

        executor.submit(() -> {
            chatService.streamChat(request.question())
                    .subscribe(
                            chunk -> {
                                try {
                                    emitter.send(SseEmitter.event().data(chunk));
                                } catch (Exception e) {
                                    log.error("Error sending SSE chunk: {}", e.getMessage());
                                    emitter.completeWithError(e);
                                }
                            },
                            error -> {
                                log.error("Stream error: {}", error.getMessage());
                                emitter.completeWithError(error);
                            },
                            () -> {
                                try {
                                    // Send a [DONE] sentinel so the client knows the stream ended
                                    emitter.send(SseEmitter.event().data("[DONE]"));
                                } catch (Exception ignored) {}
                                emitter.complete();
                            }
                    );
        });

        return emitter;
    }

    /**
     * POST /rag/chat — Regular (non-streaming) JSON response endpoint.
     */
    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ChatMessage chat(@RequestBody ChatRequest request) {
        log.debug("Chat request: question={}", request.question());
        return chatService.chat(request.question());
    }
}
