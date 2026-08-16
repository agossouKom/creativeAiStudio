package com.creativeai.auth.controller;

import com.creativeai.auth.dto.agent.AgentChatRequest;
import com.creativeai.auth.dto.agent.MemoryMessageDto;
import com.creativeai.auth.model.AgentMemory;
import com.creativeai.auth.service.agent.AgentMemoryService;
import com.creativeai.auth.service.agent.EmailAgentOrchestrator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/agent/email")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AgentEmailController {

    private final EmailAgentOrchestrator orchestrator;
    private final AgentMemoryService     memoryService;

    /**
     * POST /api/agent/email/chat
     * Streams the agent response via SSE.
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@RequestBody AgentChatRequest req) {
        String userId = resolveUserId();
        log.info("[EMAIL-AGENT] chat userId={}", userId);

        SseEmitter emitter = new SseEmitter(180_000L);

        Executors.newVirtualThreadPerTaskExecutor().submit(() ->
            orchestrator.chat(userId, req.message())
                .subscribe(
                    chunk -> {
                        try { emitter.send(SseEmitter.event().data(chunk)); }
                        catch (Exception e) { emitter.completeWithError(e); }
                    },
                    emitter::completeWithError,
                    emitter::complete
                )
        );
        return emitter;
    }

    /** GET /api/agent/email/memory — last N messages */
    @GetMapping("/memory")
    public ResponseEntity<List<MemoryMessageDto>> getMemory() {
        String userId = resolveUserId();
        List<MemoryMessageDto> messages = memoryService.getHistory(userId).stream()
            .map(m -> new MemoryMessageDto(m.getId(), m.getRole().name(),
                                           m.getContent(), m.getToolName(), m.getCreatedAt()))
            .toList();
        return ResponseEntity.ok(messages);
    }

    /** DELETE /api/agent/email/memory — clears conversation */
    @DeleteMapping("/memory")
    public ResponseEntity<Void> clearMemory() {
        memoryService.clearMemory(resolveUserId());
        return ResponseEntity.noContent().build();
    }

    private String resolveUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
