package com.creativeai.auth.controller;

import com.creativeai.auth.dto.SenderProfileDto;
import com.creativeai.auth.service.SenderProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user/profil")
@RequiredArgsConstructor
public class SenderProfileController {

    private final SenderProfileService service;

    @GetMapping
    public ResponseEntity<SenderProfileDto> get() {
        return ResponseEntity.ok(service.get());
    }

    @PostMapping
    public ResponseEntity<SenderProfileDto> upsert(@RequestBody SenderProfileDto dto) {
        return ResponseEntity.ok(service.upsert(dto));
    }
}
