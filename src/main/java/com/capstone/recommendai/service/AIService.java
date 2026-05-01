package com.capstone.recommendai.service;

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

    // 옷 이미지 분석
    public Map<String, String> analyzeImage(String imageB64) {
        String url = aiServerUrl + "/ai/analyze";
        Map<String, String> body = new HashMap<>();
        body.put("imageB64", imageB64);
        return restTemplate.postForObject(url, body, Map.class);
    }

    // 코디 추천
    public Map<String, Object> recommend(
            String tpo,
            String mode,
            Map<String, Object> weather,
            Map<String, Object> profile,
            List<Map<String, Object>> wardrobeItems,
            List<Map<String, Object>> linkedEvents) {

        String url = aiServerUrl + "/ai/recommend";
        Map<String, Object> body = new HashMap<>();
        body.put("tpo", tpo);
        body.put("mode", mode);
        body.put("weather", weather);
        body.put("profile", profile);
        body.put("wardrobeItems", wardrobeItems);
        body.put("linkedEvents", linkedEvents);

        return restTemplate.postForObject(url, body, Map.class);
    }
}