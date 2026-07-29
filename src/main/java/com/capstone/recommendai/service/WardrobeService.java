package com.capstone.recommendai.service;

/*
 * 기존 대비 변경 사항
 * ------------------
 * 1. @Slf4j 추가 (AI 서버 호출 실패 시 로그 남기기 위함)
 * 2. AIService 의존성 추가 (생성자 주입, @RequiredArgsConstructor가 자동 처리)
 * 3. addItem() — wardrobeRepository.save(item) 직후, AI 서버에 ChromaDB 임베딩 등록 요청 추가
 *    - 실패해도 옷장 저장 자체는 그대로 진행되도록 try-catch로 감쌌습니다.
 *    - 기존 WardrobeEmbedding(MySQL) 저장 로직은 그대로 유지했습니다. (건드리지 않음)
 * 4. deleteItem() — wardrobeRepository.delete(item) 이후, AI 서버에 ChromaDB 임베딩 삭제 요청 추가
 *    - 마찬가지로 실패해도 삭제 자체는 진행되도록 try-catch로 감쌌습니다.
 *
 * 적용 방법: 기존 WardrobeService.java 파일 전체를 이 내용으로 교체하세요.
 */

import com.capstone.recommendai.dto.WardrobeItemResponse;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeEmbedding;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeEmbeddingRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WardrobeService {

    private final WardrobeRepository wardrobeRepository;
    private final WardrobeEmbeddingRepository embeddingRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;
    private final AIService aiService;

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

        // 기존 임베딩 저장 (MySQL, WardrobeEmbedding) — 그대로 유지
        if (embedding != null && !embedding.isEmpty()) {
            WardrobeEmbedding emb = WardrobeEmbedding.builder()
                    .wardrobeItem(item)
                    .vectorData(embedding)
                    .modelName("fashion-clip")
                    .build();
            embeddingRepository.save(emb);
        }

        // [신규] ChromaDB에 임베딩 등록 요청
        // AI 서버가 imageB64로부터 직접 CLIP 임베딩을 생성해서 저장합니다.
        // 실패해도 옷장 아이템 저장 자체는 실패하지 않도록 예외를 여기서 처리합니다.
        if (imageB64 != null && !imageB64.isEmpty()) {
            try {
                aiService.registerEmbedding(
                        item.getItemId(),
                        user.getUserId(),
                        item.getCategory(),
                        item.getColor(),
                        item.getItemType(),
                        imageB64
                );
            } catch (Exception e) {
                log.warn("ChromaDB 임베딩 등록 실패 (itemId={}): {}", item.getItemId(), e.getMessage());
            }
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

        // [신규] ChromaDB에서도 임베딩 삭제
        try {
            aiService.deleteEmbedding(itemId);
        } catch (Exception e) {
            log.warn("ChromaDB 임베딩 삭제 실패 (itemId={}): {}", itemId, e.getMessage());
        }
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