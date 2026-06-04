package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.RecommendationResponse;
import com.capstone.recommendai.entity.*;
import com.capstone.recommendai.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    private User getUser(String userId) {
        return userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    public List<RecommendationResponse> getHistory(String userId) {
        User user = getUser(userId);
        return recommendationRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(RecommendationResponse::new).collect(Collectors.toList());
    }

    @Transactional
    public RecommendationResponse saveRecommendation(
            String userId,
            String tpo,
            List<Map<String, Object>> outfits,
            Integer temperature,
            String weatherCondition,
            String eventId,
            String outfitDate,
            List<List<Map<String, Object>>> matchedItemsPerOutfit,
            String parentRecId) {

        User user = getUser(userId);

        CalendarEvent calendarEvent = null;
        if (eventId != null && !eventId.isEmpty()) {
            calendarEvent = calendarEventRepository.findById(eventId).orElse(null);
        }

        java.time.LocalDate date = null;
        if (outfitDate != null && !outfitDate.isEmpty()) {
            date = java.time.LocalDate.parse(outfitDate);
        }

        String defaultStyle = "";
        String defaultDesc  = "";
        if (outfits != null && !outfits.isEmpty()) {
            defaultStyle = (String) outfits.get(0).getOrDefault("style", "");
            defaultDesc  = (String) outfits.get(0).getOrDefault("description", "");
        }

        int retryCount = 0;
        if (parentRecId != null && !parentRecId.isEmpty()) {
            Recommendation parent = recommendationRepository.findById(parentRecId).orElse(null);
            if (parent != null) {
                retryCount = (parent.getRetryCount() != null ? parent.getRetryCount() : 0) + 1;
            }
        }

        Recommendation rec = Recommendation.builder()
                .user(user)
                .calendarEvent(calendarEvent)
                .tpo(tpo)
                .style(defaultStyle)
                .description(defaultDesc)
                .temperature(temperature)
                .weatherCondition(weatherCondition)
                .outfitDate(date)
                .retryCount(retryCount)
                .parentRecId(parentRecId)
                .build();

        recommendationRepository.save(rec);

        // 전체 코디 정보 JSON 저장
        if (outfits != null && !outfits.isEmpty()) {
            try {
                rec.setOutfitsJson(objectMapper.writeValueAsString(outfits));
            } catch (Exception ignored) {}
        }

        // 각 코디별 아이템 저장
        int orderNum = 1;
        if (matchedItemsPerOutfit != null) {
            for (int outfitIdx = 0; outfitIdx < matchedItemsPerOutfit.size(); outfitIdx++) {
                List<Map<String, Object>> items = matchedItemsPerOutfit.get(outfitIdx);
                if (items == null) continue;
                for (Map<String, Object> matched : items) {
                    String wardrobeId = matched.get("id") != null
                            ? String.valueOf(matched.get("id")) : null;
                    Float score = matched.get("score") != null
                            ? Float.parseFloat(matched.get("score").toString()) : null;
                    String category = (String) matched.getOrDefault("category", "");

                    WardrobeItem wardrobeItem = null;
                    if (wardrobeId != null && !wardrobeId.equals("null")) {
                        wardrobeItem = wardrobeRepository.findById(wardrobeId).orElse(null);
                    }

                    rec.getItems().add(RecommendationItem.builder()
                            .recommendation(rec)
                            .orderNum(orderNum++)
                            .category(category)
                            .matchedWardrobeItem(wardrobeItem)
                            .similarityScore(score)
                            .outfitIndex(outfitIdx)
                            .build());
                }
            }
        }

        recommendationRepository.save(rec);
        return new RecommendationResponse(rec);
    }

    @Transactional
    public void acceptOutfit(String recId, Integer outfitIndex,
                             String style, String description, String userId) {
        Recommendation rec = recommendationRepository.findById(recId)
                .orElseThrow(() -> new RuntimeException("추천 없음"));
        if (!rec.getUser().getUserId().equals(userId)) {
            throw new RuntimeException("권한 없음");
        }
        rec.setAcceptedOutfitIndex(outfitIndex);
        if (style != null && !style.isEmpty())             rec.setStyle(style);
        if (description != null && !description.isEmpty()) rec.setDescription(description);
        recommendationRepository.save(rec);
    }
}