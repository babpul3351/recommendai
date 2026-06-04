package com.capstone.recommendai.controller;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.repository.RecommendationRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.service.RecommendationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationRepository recommendationRepository;
    private final UserRepository userRepository;
    private final RecommendationService recommendationService;
    private final ObjectMapper objectMapper;

    // 추천 이력 조회 — JOIN FETCH로 N+1 해결
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getRecommendations(
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        List<Map<String, Object>> result = recommendationRepository
                .findByUserWithItemsOrderByCreatedAtDesc(user)   // ← JOIN FETCH
                .stream().map(rec -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("recId",             rec.getRecId());
                    map.put("tpo",               rec.getTpo());
                    map.put("style",             rec.getStyle());
                    map.put("description",       rec.getDescription());
                    map.put("temperature",       rec.getTemperature());
                    map.put("weatherCondition",  rec.getWeatherCondition());
                    map.put("createdAt",         rec.getCreatedAt());
                    map.put("acceptedOutfitIndex", rec.getAcceptedOutfitIndex());
                    map.put("retryCount",  rec.getRetryCount() != null ? rec.getRetryCount() : 0);
                    map.put("parentRecId", rec.getParentRecId());
                    map.put("outfitDate",
                            rec.getOutfitDate() != null ? rec.getOutfitDate().toString() : null);

                    // 코디별 아이템 그룹핑
                    Map<Integer, List<Map<String, Object>>> allOutfitGroups = new TreeMap<>();
                    for (var item : rec.getItems()) {
                        int idx = item.getOutfitIndex() != null ? item.getOutfitIndex() : 0;
                        allOutfitGroups.computeIfAbsent(idx, k -> new ArrayList<>());
                        if (item.getMatchedWardrobeItem() != null) {
                            Map<String, Object> m = new HashMap<>();
                            m.put("category", item.getCategory());
                            m.put("imageUrl", item.getMatchedWardrobeItem().getImageThumbnail());
                            m.put("type",     item.getMatchedWardrobeItem().getItemType());
                            m.put("color",    item.getMatchedWardrobeItem().getColor());
                            allOutfitGroups.get(idx).add(m);
                        }
                    }
                    map.put("allOutfitGroups", allOutfitGroups);

                    // outfitsJson → 코디별 style / description 파싱
                    List<Map<String, Object>> outfitInfos = new ArrayList<>();
                    if (rec.getOutfitsJson() != null) {
                        try {
                            TypeReference<List<Map<String, Object>>> typeRef =
                                    new TypeReference<List<Map<String, Object>>>() {};
                            outfitInfos = objectMapper.readValue(rec.getOutfitsJson(), typeRef);
                        } catch (Exception ignored) {}
                    }
                    map.put("outfitInfos", outfitInfos);
                    return map;
                }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // 코디 선택
    @PutMapping("/{recId}/accept")
    public ResponseEntity<?> acceptOutfit(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String recId,
            @RequestBody Map<String, Object> body) {

        Integer outfitIndex = body.get("outfitIndex") != null
                ? ((Number) body.get("outfitIndex")).intValue() : null;
        if (outfitIndex == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "outfitIndex가 필요합니다."));
        }

        String style       = (String) body.getOrDefault("style", "");
        String description = (String) body.getOrDefault("description", "");

        recommendationService.acceptOutfit(
                recId, outfitIndex, style, description, userDetails.getUsername());

        return ResponseEntity.ok(Map.of("message", "코디가 선택됐습니다."));
    }

    // 주간/월간 코디 조회 — accept된 것만, JOIN FETCH, 날짜별 dedup
    @GetMapping("/week")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getWeekOutfits(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String start,
            @RequestParam String end) {

        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        java.time.LocalDate s = java.time.LocalDate.parse(start);
        java.time.LocalDate e = java.time.LocalDate.parse(end);

        // JOIN FETCH + accept된 것만 + 최신순 정렬
        List<Recommendation> accepted = recommendationRepository
                .findByUserAndOutfitDateBetweenWithItems(user, s, e)
                .stream()
                .filter(rec -> rec.getAcceptedOutfitIndex() != null)   // ← 핵심: accept만
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());

        // 날짜별 dedup: 날짜당 가장 최신 accept 하나만
        Map<java.time.LocalDate, Recommendation> bestByDate = new java.util.LinkedHashMap<>();
        for (Recommendation rec : accepted) {
            if (rec.getOutfitDate() != null) {
                bestByDate.putIfAbsent(rec.getOutfitDate(), rec);
            }
        }

        List<Map<String, Object>> result = bestByDate.values().stream().map(rec -> {
            Map<String, Object> map = new HashMap<>();
            map.put("recId",       rec.getRecId());
            map.put("tpo",         rec.getTpo());
            map.put("style",       rec.getStyle());
            map.put("description", rec.getDescription());
            map.put("outfitDate",  rec.getOutfitDate().toString());
            map.put("acceptedOutfitIndex", rec.getAcceptedOutfitIndex());

            int displayIdx = rec.getAcceptedOutfitIndex(); // null 아님 (필터됨)

            List<Map<String, Object>> items = rec.getItems().stream()
                    .filter(item -> displayIdx == item.getOutfitIndex()
                            && item.getMatchedWardrobeItem() != null)
                    .map(item -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("imageUrl", item.getMatchedWardrobeItem().getImageThumbnail());
                        m.put("type",     item.getMatchedWardrobeItem().getItemType());
                        m.put("color",    item.getMatchedWardrobeItem().getColor());
                        return m;
                    }).collect(Collectors.toList());
            map.put("matchedItems", items);
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}