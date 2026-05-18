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
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WardrobeService {

    private final WardrobeRepository wardrobeRepository;
    private final WardrobeEmbeddingRepository embeddingRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;

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
    public WardrobeItemResponse addItem(String userId, String imageB64,
                                        String category, String type, String color, String material, String embedding) {

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        // Base64 이미지를 S3에 업로드하고 URL 저장
        String imageUrl = null;
        if (imageB64 != null && !imageB64.isEmpty()) {
            imageUrl = s3Service.uploadBase64Image(imageB64);
        }

        WardrobeItem item = WardrobeItem.builder()
                .user(user)
                .category(category != null ? category : "기타")
                .itemType(type != null ? type : "")
                .color(color != null ? color : "")
                .material(material)
                .imageThumbnail(imageUrl)  // S3 URL 저장
                .build();

        wardrobeRepository.save(item);

        // 임베딩 저장
        if (embedding != null && !embedding.isEmpty()) {
            WardrobeEmbedding emb = WardrobeEmbedding.builder()
                    .wardrobeItem(item)
                    .vectorData(embedding)
                    .modelName("fashion-clip")
                    .build();
            embeddingRepository.save(emb);
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

    @Transactional
    public void updateItem(String userId, String itemId, Map<String, String> body) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        WardrobeItem item = wardrobeRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("아이템 없음"));

        if (!item.getUser().getUserId().equals(user.getUserId())) {
            throw new RuntimeException("권한 없음");
        }

        if (body.containsKey("category")) item.setCategory(body.get("category"));
        if (body.containsKey("type")) item.setItemType(body.get("type"));
        if (body.containsKey("color")) item.setColor(body.get("color"));
        if (body.containsKey("material")) item.setMaterial(body.get("material"));

        wardrobeRepository.save(item);
    }
}