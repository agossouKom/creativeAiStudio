package com.creativeai.auth.controller;

import com.creativeai.auth.dto.UserProductDto;
import com.creativeai.auth.service.UserProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/products")
@RequiredArgsConstructor
public class UserProductController {

    private final UserProductService service;

    @GetMapping
    public ResponseEntity<List<UserProductDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/by-code/{code}")
    public ResponseEntity<UserProductDto> byCode(@PathVariable String code) {
        return ResponseEntity.ok(service.findByCode(code));
    }

    @GetMapping("/trash")
    public ResponseEntity<List<UserProductDto>> trash() {
        return ResponseEntity.ok(service.trash());
    }

    @PostMapping
    public ResponseEntity<UserProductDto> create(@RequestBody UserProductDto dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserProductDto> update(@PathVariable String id, @RequestBody UserProductDto dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDelete(@PathVariable String id) {
        service.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<UserProductDto> restore(@PathVariable String id) {
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
