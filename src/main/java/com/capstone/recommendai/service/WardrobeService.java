package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeEmbedding;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeEmbeddingRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WardrobeService {

    private final WardrobeRepository wardrobeRepository;
    private final WardrobeEmbeddingRepository embeddingRepository;
    private final UserRepository userRepository;

    // 현재 로그인한 사용자 찾기
    private User getUser(String userId) {
        return userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    // 옷장 전체 조회
    public List<WardrobeItemResponse> getWardrobe(String userId) {
        User user = getUser(userId);
        return wardrobeRepository.findByUser(user)
                .stream()
                .map(WardrobeItemResponse::new)
                .collect(Collectors.toList());
    }

    // 옷장 아이템 추가
    @Transactional
    public WardrobeItemResponse addItem(String userId, String imageThumbnail,
                                        String category, String itemType,
                                        String color, String material,
                                        String vectorData) {
        User user = getUser(userId);

        // 옷장 아이템 저장
        WardrobeItem item = WardrobeItem.builder()
                .user(user)
                .imageThumbnail(imageThumbnail)
                .category(category)
                .itemType(itemType)
                .color(color)
                .material(material)
                .build();

        wardrobeRepository.save(item);

        // 임베딩 저장 (벡터 데이터가 있는 경우)
        if (vectorData != null && !vectorData.isEmpty()) {
            WardrobeEmbedding embedding = WardrobeEmbedding.builder()
                    .wardrobeItem(item)
                    .vectorData(vectorData)
                    .modelName("patrickjohncyh/fashion-clip")
                    .build();
            embeddingRepository.save(embedding);
        }

        return new WardrobeItemResponse(item);
    }

    // 옷장 아이템 삭제
    @Transactional
    public void deleteItem(String userId, String itemId) {
        User user = getUser(userId);
        WardrobeItem item = wardrobeRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("아이템 없음"));

        if (!item.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("삭제 권한 없음");
        }

        wardrobeRepository.delete(item);
    }
}