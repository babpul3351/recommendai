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
}