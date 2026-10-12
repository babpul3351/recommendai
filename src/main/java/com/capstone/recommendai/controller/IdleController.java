package com.capstone.recommendai.controller;

import com.capstone.recommendai.service.IdleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/idle")
@RequiredArgsConstructor
public class IdleController {

    private final IdleService idleService;

    // 유휴 의류 목록 + 계절 확인이 필요한 목록
    @GetMapping("/items")
    public ResponseEntity<?> getIdleItems(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(idleService.getIdleItems(userDetails.getUsername()));
    }

    // 전체 이력: 내가 기록한 활용 방식 + 내가 지정한 계절
    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(idleService.getHistory(userDetails.getUsername()));
    }

    // 처분 의사 기록: KEEP / RESELL / DONATE / DISCARD
    @PostMapping("/{itemId}/decision")
    public ResponseEntity<?> decide(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String itemId,
            @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(idleService.decide(userDetails.getUsername(), itemId, body.get("decision")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 중고거래 판매글 초안 생성 (brand/size/condition/price는 선택)
    @PostMapping("/{itemId}/resale-draft")
    public ResponseEntity<?> resaleDraft(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String itemId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            return ResponseEntity.ok(idleService.resaleDraft(userDetails.getUsername(), itemId, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "판매글 초안 생성에 실패했습니다."));
        }
    }
}