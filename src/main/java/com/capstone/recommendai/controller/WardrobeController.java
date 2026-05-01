package com.capstone.recommendai.controller;

import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.service.AIService;
import com.capstone.recommendai.service.WardrobeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wardrobe")
@RequiredArgsConstructor
public class WardrobeController {

    private final WardrobeService wardrobeService;
    private final AIService aiService;
    private final UserRepository userRepository;

    // 내 옷장 전체 조회
    @GetMapping
    public ResponseEntity<List<WardrobeItemResponse>> getWardrobe(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                wardrobeService.getWardrobe(userDetails.getUsername())
        );
    }

    // 옷 이미지 업로드 → AI 분석 → 옷장 저장
    @PostMapping("/upload")
    public ResponseEntity<WardrobeItemResponse> uploadItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {

        String imageB64 = body.get("imageB64");

        // Python AI 서버에서 이미지 분석
        Map<String, String> analyzed = aiService.analyzeImage(imageB64);

        // 분석 결과를 DB에 저장
        WardrobeItemResponse response = wardrobeService.addItem(
                userDetails.getUsername(),
                analyzed.get("imageB64"),   // 썸네일 이미지
                analyzed.get("category"),
                analyzed.get("type"),
                analyzed.get("color"),
                analyzed.get("material"),
                ""                          // embedding은 별도 처리
        );
        return ResponseEntity.ok(response);
    }

    // 코디 추천
    @PostMapping("/recommend")
    public ResponseEntity<Map<String, Object>> recommend(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {

        String email = userDetails.getUsername();
        String tpo   = (String) body.getOrDefault("tpo", "일상·캐주얼");
        String mode  = (String) body.getOrDefault("mode", "rag");

        // 날씨 정보
        Map<String, Object> weather = (Map<String, Object>) body.getOrDefault(
                "weather", Map.of("temp", 18, "desc", "맑음")
        );

        // 사용자 프로필 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
        Map<String, Object> profile = new HashMap<>();
        profile.put("ageGroup", user.getAgeGroup());
        profile.put("gender",   user.getGender());
        profile.put("style",    user.getStyle());

        // 내 옷장 전체 조회
        List<WardrobeItemResponse> wardrobeItems = wardrobeService.getWardrobe(email);
        List<Map<String, Object>> itemList = wardrobeItems.stream()
                .map(item -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",       item.getId());
                    m.put("category", item.getCategory()  != null ? item.getCategory()  : "");
                    m.put("type",     item.getType()      != null ? item.getType()      : "");
                    m.put("color",    item.getColor()     != null ? item.getColor()     : "");
                    m.put("material", item.getMaterial()  != null ? item.getMaterial()  : "");
                    m.put("imageB64", item.getImageB64()  != null ? item.getImageB64()  : "");
                    m.put("embedding", "");
                    return m;
                })
                .collect(Collectors.toList());

        // 연동 일정
        List<Map<String, Object>> linkedEvents =
                (List<Map<String, Object>>) body.getOrDefault("linkedEvents", new ArrayList<>());

        // Python AI 서버에 추천 요청
        Map<String, Object> result = aiService.recommend(
                tpo, mode, weather, profile, itemList, linkedEvents
        );

        return ResponseEntity.ok(result);
    }

    // 옷장 아이템 삭제
    @DeleteMapping("/{itemId}")
    public ResponseEntity<String> deleteItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long itemId) {
        wardrobeService.deleteItem(userDetails.getUsername(), itemId);
        return ResponseEntity.ok("삭제되었습니다");
    }
}