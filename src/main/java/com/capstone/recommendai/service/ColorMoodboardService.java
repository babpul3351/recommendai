package com.capstone.recommendai.service;

/*
 * [신규] 색상 보정 뷰어 - 색상 무드보드 + 옷장 색 매칭 (v2)
 * --------------------------------------------------------
 * moodboard(): 업로드 사진 -> AI 서버(/ai/color-moodboard)로 팔레트/무드 생성
 *              -> 옷장 색 백그라운드 계산 시작(ItemColorService)
 *              -> 가장 큰 옷 색(baseIndex)으로 첫 매칭 결과를 함께 반환
 * match():     사용자가 고른 기준 색으로 다시 매칭 (이미지 없이 저장된 색만 사용, 빠름)
 *
 * v1과 달리 이 요청 안에서는 옷장 이미지를 내려받지 않음. (아이템 색 계산은 ItemColorService가 백그라운드에서 담당)
 * 적용 위치: src/main/java/com/capstone/recommendai/service/ColorMoodboardService.java (기존 v1 파일 교체)
 */

import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ColorMoodboardService {

    private final String aiServerUrl;
    private final UserRepository userRepository;
    private final WardrobeRepository wardrobeRepository;
    private final ItemColorService itemColorService;
    private final RestTemplate aiRestTemplate;   // YOLO + Gemini 호출이 있어 타임아웃을 둔 별도 RestTemplate

    public ColorMoodboardService(@Value("${ai.server.url}") String aiServerUrl,
                                 UserRepository userRepository,
                                 WardrobeRepository wardrobeRepository,
                                 ItemColorService itemColorService) {
        this.aiServerUrl = aiServerUrl;
        this.userRepository = userRepository;
        this.wardrobeRepository = wardrobeRepository;
        this.itemColorService = itemColorService;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(120));   // 실측 없이 잡은 상한
        this.aiRestTemplate = new RestTemplate(factory);
    }

    public Map<String, Object> moodboard(String userId, String imageB64) {
        User user = findUser(userId);
        Map<String, Object> body = new HashMap<>();
        body.put("imageB64", imageB64);
        body.put("colorType", nz(user.getColorType()));

        @SuppressWarnings("unchecked")
        Map<String, Object> result = aiRestTemplate.postForObject(aiServerUrl + "/ai/color-moodboard", body, Map.class);
        if (result == null) {
            throw new IllegalStateException("AI 서버 응답이 비어 있습니다.");
        }

        startAnalysis(userId);

        String baseHex = baseHexOf(result);
        if (baseHex != null) {
            result.put("match", match(user, baseHex));
        }
        return result;
    }

    public Map<String, Object> match(String userId, String baseHex) {
        return match(findUser(userId), baseHex);
    }

    /** 옷장 색 백그라운드 계산 시작 (이미 실행 중이면 그대로 둠). 현재 진행 상태를 반환. */
    public Map<String, Object> startAnalysis(String userId) {
        if (itemColorService.tryMarkRunning(userId)) {
            try {
                itemColorService.analyzeMissing(userId);
            } catch (TaskRejectedException e) {
                itemColorService.unmarkRunning(userId);
                log.warn("[moodboard] 옷장 색 계산 대기열이 가득 찼습니다: {}", e.getMessage());
            }
        }
        return itemColorService.status(userId);
    }

    private Map<String, Object> match(User user, String baseHex) {
        List<WardrobeItem> items = wardrobeRepository.findByUser(user);
        Map<String, WardrobeItem> byId = items.stream()
                .collect(Collectors.toMap(WardrobeItem::getItemId, Function.identity(), (a, b) -> a));

        List<Map<String, String>> payload = new ArrayList<>();
        for (WardrobeItem it : items) {
            Map<String, String> m = new HashMap<>();
            m.put("id", it.getItemId());
            m.put("category", nz(it.getCategory()));
            m.put("dominantColors", nz(it.getDominantColors()));
            payload.add(m);
        }
        Map<String, Object> body = new HashMap<>();
        body.put("baseHex", baseHex);
        body.put("colorType", nz(user.getColorType()));
        body.put("items", payload);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = aiRestTemplate.postForObject(aiServerUrl + "/ai/color-match", body, Map.class);
        if (result == null) {
            throw new IllegalStateException("AI 서버 응답이 비어 있습니다.");
        }
        result.put("matches", enrich(result.get("matches"), byId));
        result.put("confusions", enrich(result.get("confusions"), byId));
        result.put("sameFamily", enrich(result.get("sameFamily"), byId));   // [추가] 같은 색 계열 옷
        result.put("status", itemColorService.status(user.getUserId(), items));
        return result;
    }

    /** AI 서버 결과(itemId 기준)에 아이템 이름, 카테고리, 이미지 URL을 붙인다. 내 옷장에 없는 id는 버림. */
    private List<Map<String, Object>> enrich(Object raw, Map<String, WardrobeItem> byId) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (!(raw instanceof List<?> list)) return out;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> mm)) continue;
            WardrobeItem it = byId.get(String.valueOf(mm.get("itemId")));
            if (it == null) continue;
            Map<String, Object> e = new HashMap<>();
            mm.forEach((k, v) -> e.put(String.valueOf(k), v));
            e.put("type", it.getItemType());
            e.put("category", it.getCategory());
            e.put("color", it.getColor());
            e.put("imageUrl", it.getImageThumbnail());
            out.add(e);
        }
        return out;
    }

    private static String baseHexOf(Map<String, Object> result) {
        Object palette = result.get("palette");
        Object baseIndex = result.get("baseIndex");
        if (!(palette instanceof List<?> list) || !(baseIndex instanceof Number n)) return null;
        for (Object o : list) {
            if (o instanceof Map<?, ?> p && p.get("index") instanceof Number idx && idx.intValue() == n.intValue()) {
                Object hex = p.get("hex");
                return hex == null ? null : hex.toString();
            }
        }
        return null;
    }

    private User findUser(String userId) {
        return userRepository.findByUserId(userId).orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}