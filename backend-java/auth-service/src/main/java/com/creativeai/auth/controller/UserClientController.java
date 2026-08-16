package com.creativeai.auth.controller;

import com.creativeai.auth.dto.UserClientDto;
import com.creativeai.auth.service.UserClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/clients")
@RequiredArgsConstructor
public class UserClientController {

    private final UserClientService service;

    @GetMapping
    public ResponseEntity<List<UserClientDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/trash")
    public ResponseEntity<List<UserClientDto>> trash() {
        return ResponseEntity.ok(service.trash());
    }

    @PostMapping
    public ResponseEntity<UserClientDto> create(@RequestBody UserClientDto dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserClientDto> update(@PathVariable String id, @RequestBody UserClientDto dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDelete(@PathVariable String id) {
        service.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<UserClientDto> restore(@PathVariable String id) {
        return ResponseEntity.ok(service.restore(id));
    }

    @DeleteMapping("/{id}/hard")
    public ResponseEntity<Void> hardDelete(@PathVariable String id) {
        service.hardDelete(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/trash/empty")
    public ResponseEntity<Void> emptyTrash() {
        service.emptyTrash();
        return ResponseEntity.noContent().build();
    }
}
