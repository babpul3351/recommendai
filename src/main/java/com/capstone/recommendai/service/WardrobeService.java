package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WardrobeService {

    private final WardrobeRepository wardrobeRepository;
    private final UserRepository userRepository;

    // 현재 로그인한 사용자 찾기
    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    // 옷장 전체 조회
    public List<WardrobeItemResponse> getWardrobe(String email) {
        User user = getUser(email);
        return wardrobeRepository.findByUser(user)
                .stream()
                .map(WardrobeItemResponse::new)
                .collect(Collectors.toList());
    }

    // 옷장 아이템 추가 (이미지 분석은 Python AI 서버에서 처리)
    public WardrobeItemResponse addItem(String email, String imageB64,
                                        String category, String type,
                                        String color, String material,
                                        String embedding) {
        User user = getUser(email);

        WardrobeItem item = WardrobeItem.builder()
                .user(user)
                .imageB64(imageB64)
                .category(category)
                .type(type)
                .color(color)
                .material(material)
                .embedding(embedding)
                .build();

        wardrobeRepository.save(item);
        return new WardrobeItemResponse(item);
    }

    // 옷장 아이템 삭제
    public void deleteItem(String email, Long itemId) {
        User user = getUser(email);
        WardrobeItem item = wardrobeRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("아이템 없음"));

        // 본인 아이템인지 확인
        if (!item.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("삭제 권한 없음");
        }

        wardrobeRepository.delete(item);
    }
}