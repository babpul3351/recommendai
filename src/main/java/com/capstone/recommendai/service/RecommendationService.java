package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.RecommendationResponse;
import com.capstone.recommendai.entity.*;
import com.capstone.recommendai.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final RecommendationRepository recommendationRepository;
    private final UserRepository userRepository;
    private final WardrobeRepository wardrobeRepository;
    private final CalendarEventRepository calendarEventRepository;

    private User getUser(String userId) {
        return userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    // 추천 이력 조회
    public List<RecommendationResponse> getHistory(String userId) {
        User user = getUser(userId);
        return recommendationRepository.findByUserOrderByCreatedAtDesc(user)
                .stream()
                .map(RecommendationResponse::new)
                .collect(Collectors.toList());
    }

    // 추천 결과 저장
    @Transactional
    public RecommendationResponse saveRecommendation(
            String userId,
            String tpo,
            String style,
            String description,
            Integer temperature,
            String weatherCondition,
            String eventId,
            String outfitDate,
            List<Map<String, Object>> matchedItems) {

        User user = getUser(userId);

        CalendarEvent calendarEvent = null;
        if (eventId != null && !eventId.isEmpty()) {
            calendarEvent = calendarEventRepository.findById(eventId).orElse(null);
        }

        java.time.LocalDate date = null;
        if (outfitDate != null && !outfitDate.isEmpty()) {
            date = java.time.LocalDate.parse(outfitDate);
        }

        Recommendation rec = Recommendation.builder()
                .user(user)
                .calendarEvent(calendarEvent)
                .tpo(tpo)
                .style(style)
                .description(description)
                .temperature(temperature)
                .weatherCondition(weatherCondition)
                .outfitDate(date)
                .build();

        recommendationRepository.save(rec);

        int orderNum = 1;
        for (Map<String, Object> matched : matchedItems) {
            String wardrobeItemId = (String) matched.get("id");
            Float score = matched.get("score") != null
                    ? Float.parseFloat(matched.get("score").toString()) : null;
            String category = (String) matched.get("category");

            WardrobeItem wardrobeItem = null;
            if (wardrobeItemId != null) {
                wardrobeRepository.findById(wardrobeItemId).orElse(null);
            }

            RecommendationItem recItem = RecommendationItem.builder()
                    .recommendation(rec)
                    .orderNum(orderNum++)
                    .category(category != null ? category : "")
                    .matchedWardrobeItem(wardrobeItem)
                    .similarityScore(score)
                    .build();

            rec.getItems().add(recItem);
        }

        recommendationRepository.save(rec);
        return new RecommendationResponse(rec);
    }
}