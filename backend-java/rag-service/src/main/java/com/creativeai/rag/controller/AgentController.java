package com.creativeai.rag.controller;

import com.creativeai.rag.model.AgentRequest;
import com.creativeai.rag.service.AgentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Contrôleur central pour tous les agents IA du module Agentique.
 * Tous les endpoints exposent un flux SSE (Server-Sent Events) pour le streaming.
 *
 * Routes exposées (via API Gateway sur /api/agent/*) :
 *   POST /agent/email/stream       → Agent Email Assistant
 *   POST /agent/resume/stream      → Agent Résumé Intelligent
 *   POST /agent/marketing/stream   → Agent Marketing Digital
 *   POST /agent/slides/stream      → Agent Slides/PowerPoint
 *   POST /agent/prospection/stream → Agent Prospection Commerciale
 *   POST /agent/cv/stream          → Analyseur de CV
 */
@Slf4j
@RestController
@RequestMapping("/agent")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    // ── Agent Email ──────────────────────────────────────────────────────────

    @PostMapping(value = "/email/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter emailStream(@RequestBody AgentRequest request) {
        log.info("Agent Email stream [type={}]", request.type());
        return buildEmitter(agentService.streamEmailAnalysis(request));
    }

    // ── Agent Résumé ─────────────────────────────────────────────────────────

    @PostMapping(value = "/resume/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter resumeStream(@RequestBody AgentRequest request) {
        log.info("Agent Résumé stream");
        return buildEmitter(agentService.streamDocumentResume(request));
    }

    // ── Agent Marketing ──────────────────────────────────────────────────────

    @PostMapping(value = "/marketing/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter marketingStream(@RequestBody AgentRequest request) {
        log.info("Agent Marketing stream [type={}]", request.type());
        return buildEmitter(agentService.streamMarketingContent(request));
    }

    // ── Agent Slides ─────────────────────────────────────────────────────────

    @PostMapping(value = "/slides/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter slidesStream(@RequestBody AgentRequest request) {
        log.info("Agent Slides stream");
        return buildEmitter(agentService.streamSlidesContent(request));
    }

    // ── Agent Prospection ─────────────────────────────────────────────────────

    @PostMapping(value = "/prospection/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter prospectionStream(@RequestBody AgentRequest request) {
        log.info("Agent Prospection stream [type={}]", request.type());
        return buildEmitter(agentService.streamProspectionMessage(request));
    }

    // ── Agent CV Analyzer ─────────────────────────────────────────────────────

    @PostMapping(value = "/cv/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter cvAnalyzeStream(@RequestBody AgentRequest request) {
        log.info("Agent CV Analyzer stream");
        return buildEmitter(agentService.streamCvAnalysis(request));
    }

    // ── Utilitaire SSE ────────────────────────────────────────────────────────

    private SseEmitter buildEmitter(reactor.core.publisher.Flux<String> flux) {
        SseEmitter emitter = new SseEmitter(120_000L);
        executor.submit(() -> flux.subscribe(
                chunk -> {
                    try { emitter.send(SseEmitter.event().data(chunk)); }
                    catch (Exception e) { emitter.completeWithError(e); }
                },
                error -> {
                    log.error("Agent stream error: {}", error.getMessage());
                    emitter.completeWithError(error);
                },
                () -> {
                    try { emitter.send(SseEmitter.event().data("[DONE]")); }
                    catch (Exception ignored) {}
                    emitter.complete();
                }
        ));
        return emitter;
    }
}
