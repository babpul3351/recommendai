package com.capstone.recommendai.controller;

/*
 * 변경 사항 (기존 대비)
 * ------------------
 * 1. getProfile()에 correctionEnabled 응답 필드 추가
 * 2. updateProfile()에 correctionEnabled 처리 추가 (토글 클릭 시 이 API로 저장)
 *
 * 다른 메서드(updateColorType, daltonize)는 변경하지 않았습니다.
 *
 * 적용 방법: 기존 UserController.java 파일 전체를 이 내용으로 교체하세요.
 */

import com.capstone.recommendai.entity.Style;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.UserStyle;
import com.capstone.recommendai.repository.StyleRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.UserStyleRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserRepository userRepository;
    private final UserStyleRepository userStyleRepository;
    private final StyleRepository styleRepository;
    private final RestTemplate restTemplate;
    private final String aiServerUrl;

    public UserController(
            UserRepository userRepository,
            UserStyleRepository userStyleRepository,
            StyleRepository styleRepository,
            RestTemplate restTemplate,
            @Value("${ai.server.url}") String aiServerUrl) {
        this.userRepository = userRepository;
        this.userStyleRepository = userStyleRepository;
        this.styleRepository = styleRepository;
        this.restTemplate = restTemplate;
        this.aiServerUrl = aiServerUrl;
    }

    // 프로필 조회
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        List<String> styles = userStyleRepository.findByUser(user)
                .stream().map(us -> us.getStyle().getStyleCode())
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("userId", user.getUserId());
        result.put("loginId", user.getLoginId());
        result.put("nickname", user.getNickname());
        result.put("ageGroup", user.getAgeGroup());
        result.put("gender", user.getGender());
        result.put("colorType", user.getColorType());
        result.put("correctionEnabled", user.getCorrectionEnabled());  // [신규]
        result.put("styles", styles);
        result.put("createdAt", user.getCreatedAt());
        return ResponseEntity.ok(result);
    }

    // 프로필 수정
    @Transactional
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {
        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        if (body.containsKey("nickname")) user.setNickname((String) body.get("nickname"));
        if (body.containsKey("ageGroup")) user.setAgeGroup((String) body.get("ageGroup"));
        if (body.containsKey("gender")) user.setGender((String) body.get("gender"));
        if (body.containsKey("colorType")) user.setColorType((String) body.get("colorType"));
        // [신규] 색각 보정 토글 on/off 저장
        if (body.containsKey("correctionEnabled")) {
            user.setCorrectionEnabled((Boolean) body.get("correctionEnabled"));
        }
        userRepository.save(user);

        if (body.containsKey("styles")) {
            List<String> newStyles = (List<String>) body.get("styles");
            userStyleRepository.deleteByUser(user);
            for (String styleCode : newStyles) {
                Style style = styleRepository.findById(styleCode).orElse(null);
                if (style != null) {
                    UserStyle us = new UserStyle();
                    us.setUser(user);
                    us.setStyle(style);
                    userStyleRepository.save(us);
                }
            }
        }
        return ResponseEntity.ok(Map.of("message", "프로필이 수정됐습니다."));
    }

    // 색각 유형 저장
    @PutMapping("/color-type")
    public ResponseEntity<?> updateColorType(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));
        user.setColorType(body.get("colorType"));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "색각 유형이 저장됐습니다."));
    }

    // Daltonization 보정
    @PostMapping("/color-assistant/daltonize")
    public ResponseEntity<?> daltonize(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String url = aiServerUrl + "/ai/daltonize";
        Map<String, String> request = new HashMap<>();
        request.put("imageB64", body.get("imageB64"));
        request.put("colorType", body.get("colorType"));
        Map result = restTemplate.postForObject(url, request, Map.class);
        return ResponseEntity.ok(result);
    }
}