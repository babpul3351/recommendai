package com.capstone.recommendai.controller;

import com.capstone.recommendai.dto.RecommendationResponse;
import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.UserStyle;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.UserStyleRepository;
import com.capstone.recommendai.service.AIService;
import com.capstone.recommendai.service.RecommendationService;
import com.capstone.recommendai.service.WardrobeService;
import com.capstone.recommendai.service.WeatherService;
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
    private final RecommendationService recommendationService;
    private final UserRepository userRepository;
    private final UserStyleRepository userStyleRepository;
    private final WeatherService weatherService;

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

        // 디버그용 로그
        System.out.println("=== 받은 imageB64 길이: " +
                (imageB64 != null ? imageB64.length() : "null"));
        System.out.println("=== Body 키 목록: " + body.keySet());

        if (imageB64 == null || imageB64.isEmpty()) {
            throw new IllegalArgumentException("imageB64가 비어있습니다");
        }

        Map analyzed = aiService.analyzeImage(imageB64);

        WardrobeItemResponse response = wardrobeService.addItem(
                userDetails.getUsername(),
                (String) analyzed.get("imageB64"),
                (String) analyzed.get("category"),
                (String) analyzed.get("type"),
                (String) analyzed.get("color"),
                (String) analyzed.get("material"),
                ""
        );
        return ResponseEntity.ok(response);
    }

    // 코디 추천
    @PostMapping("/recommend")
    public ResponseEntity<Map<String, Object>> recommend(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {

        String userId = userDetails.getUsername();
        String tpo    = (String) body.getOrDefault("tpo", "일상·캐주얼");
        String mode   = (String) body.getOrDefault("mode", "rag");
        String eventId = (String) body.get("eventId");

        // 날씨 정보 — 요청에 없으면 OpenWeather API로 자동 조회
        Map<String, Object> weather;
        if (body.containsKey("weather")) {
            weather = (Map<String, Object>) body.get("weather");
        } else {
            weather = weatherService.getCurrentWeather("Seoul", "KR");
        }

        // 사용자 프로필 조회
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));

        List<String> styleCodes = userStyleRepository.findByUser(user).stream()
                .map(us -> us.getStyle().getStyleCode())
                .collect(Collectors.toList());

        Map<String, Object> profile = new HashMap<>();
        profile.put("ageGroup", user.getAgeGroup());
        profile.put("gender",   user.getGender());
        profile.put("styles",   styleCodes);

        // 내 옷장 조회
        List<WardrobeItemResponse> wardrobeItems = wardrobeService.getWardrobe(userId);
        List<Map<String, Object>> itemList = wardrobeItems.stream()
                .map(item -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",        item.getId());
                    m.put("category",  item.getCategory() != null ? item.getCategory() : "");
                    m.put("type",      item.getType()     != null ? item.getType()     : "");
                    m.put("color",     item.getColor()    != null ? item.getColor()    : "");
                    m.put("material",  item.getMaterial() != null ? item.getMaterial() : "");
                    m.put("imageB64",  item.getImageB64() != null ? item.getImageB64() : "");
                    m.put("embedding", "");
                    return m;
                })
                .collect(Collectors.toList());

        // 연동 일정
        List<Map<String, Object>> linkedEvents =
                (List<Map<String, Object>>) body.getOrDefault("linkedEvents", new ArrayList<>());

        // Python AI 서버에 추천 요청
        Map<String, Object> aiResult = aiService.recommend(
                tpo, mode, weather, profile, itemList, linkedEvents
        );

        // 추천 결과 DB 저장
        List<Map<String, Object>> matchedItems =
                (List<Map<String, Object>>) aiResult.getOrDefault("matched_items", new ArrayList<>());

        Map<String, Object> outfit =
                (Map<String, Object>) aiResult.getOrDefault("outfit", new HashMap<>());

        RecommendationResponse saved = recommendationService.saveRecommendation(
                userId,
                tpo,
                (String) outfit.getOrDefault("style", ""),
                (String) outfit.getOrDefault("description", ""),
                weather.get("temp") != null
                        ? Integer.parseInt(weather.get("temp").toString()) : null,
                (String) weather.getOrDefault("desc", ""),
                eventId,
                matchedItems
        );

        // AI 결과 + 저장된 추천 ID 함께 반환
        aiResult.put("recId", saved.getRecId());
        return ResponseEntity.ok(aiResult);
    }

    // 옷장 아이템 삭제
    @DeleteMapping("/{itemId}")
    public ResponseEntity<String> deleteItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String itemId) {
        wardrobeService.deleteItem(userDetails.getUsername(), itemId);
        return ResponseEntity.ok("삭제되었습니다");
    }
}