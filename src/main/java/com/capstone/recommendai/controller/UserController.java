package com.capstone.recommendai.controller;

import com.capstone.recommendai.entity.Style;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.UserStyle;
import com.capstone.recommendai.repository.StyleRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.UserStyleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserStyleRepository userStyleRepository;
    private final StyleRepository styleRepository;

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
        result.put("styles", styles);
        result.put("createdAt", user.getCreatedAt());

        return ResponseEntity.ok(result);
    }

    // 프로필 수정
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {
        User user = userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        if (body.containsKey("nickname")) {
            user.setNickname((String) body.get("nickname"));
        }
        if (body.containsKey("ageGroup")) {
            user.setAgeGroup((String) body.get("ageGroup"));
        }
        if (body.containsKey("gender")) {
            user.setGender((String) body.get("gender"));
        }
        if (body.containsKey("colorType")) {
            user.setColorType((String) body.get("colorType"));
        }
        userRepository.save(user);

        // 스타일 수정
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
}