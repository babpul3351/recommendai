package com.capstone.recommendai.controller;

import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.repository.CalendarEventRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.UserStyleRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
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
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/wardrobe")
@RequiredArgsConstructor
public class WardrobeController {

    private final WardrobeService wardrobeService;
    private final WardrobeRepository wardrobeRepository;
    private final AIService aiService;
    private final RecommendationService recommendationService;
    private final UserRepository userRepository;
    private final UserStyleRepository userStyleRepository;
    private final WeatherService weatherService;
    private final CalendarEventRepository calendarEventRepository;
    private final RestTemplate restTemplate;

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

        System.out.println("=== 받은 imageB64 길이: " +
                (imageB64 != null ? imageB64.length() : "null"));
        System.out.println("=== Body 키 목록: " + body.keySet());

        if (imageB64 == null || imageB64.isEmpty()) {
            throw new IllegalArgumentException("imageB64가 비어있습니다");
        }

        Map analyzed = aiService.analyzeImage(imageB64);

        String style = (String) analyzed.get("style");
        String styleTags = style != null ? "[\"" + style + "\"]" : null;

        WardrobeItemResponse response = wardrobeService.addItem(
                userDetails.getUsername(),
                (String) analyzed.get("imageB64"),
                (String) analyzed.get("category"),
                (String) analyzed.get("type"),
                (String) analyzed.get("color"),
                (String) analyzed.get("material"),
                "",
                styleTags
        );
        return ResponseEntity.ok(response);
    }


    // 코디 추천
    @PostMapping("/recommend")
    public ResponseEntity<?> recommend(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {

        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        Map<String, Object> weather;
        if (body.containsKey("weather")) {
            weather = (Map<String, Object>) body.get("weather");
        } else {
            weather = weatherService.getCurrentWeather("Seoul", "KR");
        }

        List<WardrobeItemResponse> itemResponses = wardrobeRepository.findByUser(user)
                .stream().map(WardrobeItemResponse::new).collect(Collectors.toList());

        List<String> styles = userStyleRepository.findByUser(user)
                .stream().map(us -> us.getStyle().getStyleCode()).collect(Collectors.toList());
        Map<String, Object> profile = new HashMap<>();
        profile.put("ageGroup", user.getAgeGroup());
        profile.put("gender",   user.getGender());
        profile.put("styles",   styles);

        List<Map<String, Object>> linkedEvents = new ArrayList<>();
        if (body.containsKey("linkedEventIds")) {
            List<String> eventIds = (List<String>) body.get("linkedEventIds");
            for (String eventId : eventIds) {
                calendarEventRepository.findById(eventId).ifPresent(event -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("eventId",       event.getEventId());
                    m.put("eventName",     event.getEventName());
                    m.put("tpoKeyword",    event.getTpoKeyword());
                    m.put("eventDatetime", event.getEventDatetime().toString());
                    linkedEvents.add(m);
                });
            }
        }

        String tpo      = (String) body.getOrDefault("tpo", "일상");
        String mode     = (String) body.getOrDefault("mode", "rag");
        int numOutfits  = body.containsKey("numOutfits")
                ? ((Number) body.get("numOutfits")).intValue() : 2;
        String parentRecId = (String) body.get("parentRecId");
        String outfitDate  = (String) body.getOrDefault("outfitDate", null);

        @SuppressWarnings("unchecked")
        List<String> excludeItemIds = (List<String>) body.getOrDefault("excludeItemIds", new ArrayList<>());

        Map<String, Object> aiResult = aiService.recommend(
                tpo, mode, weather, profile,
                itemResponses.stream()
                        .filter(item -> !excludeItemIds.contains(item.getId()))
                        .map(item -> {
                            Map<String, Object> map = new HashMap<>();
                            map.put("id",       item.getId());
                            map.put("category", item.getCategory());
                            map.put("type",     item.getType());
                            map.put("color",    item.getColor());
                            map.put("material", item.getMaterial());
                            map.put("imageUrl", item.getImageUrl());
                            map.put("styleTags", item.getStyleTags());
                            return map;
                        }).collect(Collectors.toList()),
                linkedEvents,
                numOutfits);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> outfits =
                (List<Map<String, Object>>) aiResult.getOrDefault("outfits", new ArrayList<>());
        @SuppressWarnings("unchecked")
        List<List<Map<String, Object>>> matchedItemsPerOutfit =
                (List<List<Map<String, Object>>>) aiResult.getOrDefault("matched_items_per_outfit", new ArrayList<>());

        Integer temperature    = weather.get("temp") != null
                ? Integer.parseInt(weather.get("temp").toString()) : null;
        String weatherCondition = (String) weather.getOrDefault("desc", "");
        String firstEventId    = linkedEvents.isEmpty() ? null
                : (String) linkedEvents.get(0).get("eventId");

        var saved = recommendationService.saveRecommendation(
                user.getUserId(), tpo, outfits, temperature, weatherCondition,
                firstEventId, outfitDate, matchedItemsPerOutfit, parentRecId);

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

    // 옷장 아이템 수정
    @PutMapping("/{itemId}")
    public ResponseEntity<?> updateItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String itemId,
            @RequestBody Map<String, String> body) {

        wardrobeService.updateItem(userDetails.getUsername(), itemId, body);
        return ResponseEntity.ok(Map.of("message", "수정됐습니다."));
    }

    @GetMapping("/image-proxy")
    public ResponseEntity<byte[]> proxyImage(
            @RequestParam String url,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            byte[] imageBytes = restTemplate.getForObject(url, byte[].class);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_JPEG);
            return ResponseEntity.ok().headers(headers).body(imageBytes);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}