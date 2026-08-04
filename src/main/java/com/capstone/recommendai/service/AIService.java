package com.capstone.recommendai.service;

/*
 * 기존 대비 변경 사항
 * ------------------
 * registerEmbedding(), deleteEmbedding() 메서드 추가.
 * 기존 analyzeImage(), recommend()와 동일한 스타일(RestTemplate + aiServerUrl)로 작성했습니다.
 *
 * 적용 방법: 기존 AIService.java 파일 전체를 이 내용으로 교체하세요.
 */

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AIService {
    @Value("${ai.server.url}")
    private String aiServerUrl;
    private final RestTemplate restTemplate;

    public Map analyzeImage(String imageB64) {
        Map<String, String> body = new HashMap<>();
        body.put("imageB64", imageB64);
        return restTemplate.postForObject(aiServerUrl + "/ai/analyze", body, Map.class);
    }

    public Map recommend(
            String tpo, String mode,
            Map<String, Object> weather,
            Map<String, Object> profile,
            List<Map<String, Object>> wardrobeItems,
            List<Map<String, Object>> linkedEvents,
            int numOutfits) {
        Map<String, Object> body = new HashMap<>();
        body.put("tpo",          tpo);
        body.put("mode",         mode);
        body.put("weather",      weather);
        body.put("profile",      profile);
        body.put("wardrobeItems", wardrobeItems);
        body.put("linkedEvents", linkedEvents);
        body.put("numOutfits",   numOutfits);
        return restTemplate.postForObject(aiServerUrl + "/ai/recommend", body, Map.class);
    }

    // ─────────────────────────────────────────────
    // [신규] ChromaDB 임베딩 등록
    // 옷장 아이템 저장 직후 호출 (WardrobeService.addItem)
    // ─────────────────────────────────────────────
    public Map registerEmbedding(
            String itemId, String userId,
            String category, String color, String type,
            String imageB64) {
        Map<String, Object> body = new HashMap<>();
        body.put("itemId",   itemId);
        body.put("userId",   userId);
        body.put("category", category);
        body.put("color",    color);
        body.put("type",     type);
        body.put("imageB64", imageB64);
        return restTemplate.postForObject(aiServerUrl + "/ai/wardrobe/embed", body, Map.class);
    }

    // ─────────────────────────────────────────────
    // [신규] ChromaDB 임베딩 삭제
    // 옷장 아이템 삭제 직후 호출 (WardrobeService.deleteItem)
    // ─────────────────────────────────────────────
    public void deleteEmbedding(String itemId) {
        restTemplate.delete(aiServerUrl + "/ai/wardrobe/embed/" + itemId);
    }
}