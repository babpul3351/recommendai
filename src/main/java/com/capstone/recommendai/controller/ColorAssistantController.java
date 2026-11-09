package com.capstone.recommendai.controller;

/*
 * [신규] 색상 보정 뷰어 - 색상 무드보드 + 옷장 색 매칭 (v2)
 *   POST /api/user/color-assistant/moodboard               { "imageB64": "data:image/...;base64,..." }
 *   POST /api/user/color-assistant/match                   { "baseHex": "#A57861" }   기준 색을 바꿔 다시 찾기
 *   POST /api/user/color-assistant/wardrobe-colors/analyze 옷장 색 백그라운드 계산 시작 (페이지 진입 시 호출)
 *   GET  /api/user/color-assistant/wardrobe-colors/status  옷장 색 계산 진행 상태
 *
 * 기존 /api/user/color-assistant/daltonize 는 UserController에 그대로 있음. (경로가 달라 충돌하지 않음)
 * 적용 위치: src/main/java/com/capstone/recommendai/controller/ColorAssistantController.java (기존 v1 파일 교체)
 */

import com.capstone.recommendai.service.ColorMoodboardService;
import com.capstone.recommendai.service.ItemColorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/user/color-assistant")
@RequiredArgsConstructor
public class ColorAssistantController {

    private static final int MAX_IMAGE_CHARS = 15_000_000;   // 프론트에서 1280px로 줄여 보내므로 보통 훨씬 작음
    private static final Pattern HEX = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final ColorMoodboardService colorMoodboardService;
    private final ItemColorService itemColorService;

    @PostMapping("/moodboard")
    public ResponseEntity<?> moodboard(@AuthenticationPrincipal UserDetails userDetails,
                                       @RequestBody Map<String, Object> body) {
        Object image = body == null ? null : body.get("imageB64");
        if (!(image instanceof String imageB64) || imageB64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "imageB64가 필요합니다."));
        }
        if (imageB64.length() > MAX_IMAGE_CHARS) {
            return ResponseEntity.badRequest().body(Map.of("message", "이미지가 너무 큽니다."));
        }
        return handle("무드보드를 만들지 못했어요.",
                () -> colorMoodboardService.moodboard(userDetails.getUsername(), imageB64));
    }

    @PostMapping("/match")
    public ResponseEntity<?> match(@AuthenticationPrincipal UserDetails userDetails,
                                   @RequestBody Map<String, Object> body) {
        Object hex = body == null ? null : body.get("baseHex");
        if (!(hex instanceof String baseHex) || !HEX.matcher(baseHex).matches()) {
            return ResponseEntity.badRequest().body(Map.of("message", "baseHex 형식이 올바르지 않습니다."));
        }
        return handle("옷장에서 색을 찾지 못했어요.",
                () -> colorMoodboardService.match(userDetails.getUsername(), baseHex));
    }

    @PostMapping("/wardrobe-colors/analyze")
    public ResponseEntity<?> analyze(@AuthenticationPrincipal UserDetails userDetails) {
        return handle("옷장 색 분석을 시작하지 못했어요.",
                () -> colorMoodboardService.startAnalysis(userDetails.getUsername()));
    }

    @GetMapping("/wardrobe-colors/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal UserDetails userDetails) {
        return handle("옷장 색 분석 상태를 불러오지 못했어요.",
                () -> itemColorService.status(userDetails.getUsername()));
    }

    private ResponseEntity<?> handle(String failMessage, Supplier<Object> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (HttpStatusCodeException e) {
            // AI 서버 상세 오류(내부 정보)는 브라우저로 넘기지 않음
            log.warn("[color-assistant] AI 서버 오류 {}: {}", e.getStatusCode(), e.getMessage());
            String msg = e.getStatusCode().value() == 422
                    ? "사진에서 색을 추출하지 못했어요. 다른 사진으로 시도해 주세요."
                    : failMessage;
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", msg));
        } catch (ResourceAccessException e) {
            log.warn("[color-assistant] AI 서버 연결/시간 초과: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body(Map.of("message", "AI 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요."));
        } catch (Exception e) {
            log.error("[color-assistant] 처리 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", failMessage));
        }
    }
}