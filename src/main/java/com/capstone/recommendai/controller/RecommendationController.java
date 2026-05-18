package com.capstone.recommendai.controller;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.repository.RecommendationRepository;
import com.capstone.recommendai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationRepository recommendationRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getRecommendations(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        List<Recommendation> list = recommendationRepository.findByUserOrderByCreatedAtDesc(user);

        List<Map<String, Object>> result = list.stream().map(rec -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("recId", rec.getRecId());
            map.put("tpo", rec.getTpo());
            map.put("style", rec.getStyle());
            map.put("description", rec.getDescription());
            map.put("temperature", rec.getTemperature());
            map.put("weatherCondition", rec.getWeatherCondition());
            map.put("createdAt", rec.getCreatedAt());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // 주간 코디 조회 (홈 화면용)
    @GetMapping("/week")
    public ResponseEntity<?> getWeekOutfits(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String start,
            @RequestParam String end) {

        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        java.time.LocalDate startDate = java.time.LocalDate.parse(start);
        java.time.LocalDate endDate = java.time.LocalDate.parse(end);

        List<Recommendation> list = recommendationRepository
                .findByUserAndOutfitDateBetween(user, startDate, endDate);

        List<Map<String, Object>> result = list.stream().map(rec -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("recId", rec.getRecId());
            map.put("tpo", rec.getTpo());
            map.put("style", rec.getStyle());
            map.put("description", rec.getDescription());
            map.put("outfitDate", rec.getOutfitDate() != null
                    ? rec.getOutfitDate().toString() : null);
            map.put("matchedItems", rec.getItems().stream()
                    .filter(item -> item.getMatchedWardrobeItem() != null)
                    .map(item -> {
                        Map<String, Object> m = new java.util.HashMap<>();
                        m.put("imageUrl", item.getMatchedWardrobeItem().getImageThumbnail());
                        m.put("type", item.getMatchedWardrobeItem().getItemType());
                        m.put("color", item.getMatchedWardrobeItem().getColor());
                        return m;
                    }).collect(java.util.stream.Collectors.toList()));
            return map;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(result);
    }
}