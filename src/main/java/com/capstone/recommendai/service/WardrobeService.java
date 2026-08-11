package com.capstone.recommendai.service;

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
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WardrobeService {

    private final WardrobeRepository wardrobeRepository;

    private final WardrobeEmbeddingRepository embeddingRepository;

    private final UserRepository userRepository;

    private final S3Service s3Service;

    private final AIService aiService;


    // =========================================================
    // 사용자 찾기
    // =========================================================

    private User getUser(String userId) {

        return userRepository
                .findByUserId(userId)
                .orElseThrow(
                        () -> new IllegalArgumentException("사용자 없음")
                );
    }


    // =========================================================
    // 옷장 전체 조회
    // =========================================================

    public List<WardrobeItemResponse> getWardrobe(
            String userId) {

        User user = getUser(userId);

        return wardrobeRepository
                .findByUser(user)
                .stream()
                .map(WardrobeItemResponse::new)
                .collect(Collectors.toList());
    }


    // =========================================================
    // 옷 추가
    // =========================================================

    @Transactional
    public WardrobeItemResponse addItem(
            String userId,
            String imageB64,
            String category,
            String type,
            String color,
            String material,
            String styleTags,
            String embedding) {

        User user = userRepository
                .findByUserId(userId)
                .orElseThrow(
                        () -> new RuntimeException("사용자 없음")
                );


        // =====================================================
        // S3 이미지 업로드
        // =====================================================

        String imageUrl = null;

        if (imageB64 != null && !imageB64.isEmpty()) {

            imageUrl =
                    s3Service.uploadBase64Image(
                            imageB64
                    );
        }


        // =====================================================
        // 옷장 아이템 생성
        // =====================================================

        WardrobeItem item = WardrobeItem.builder()
                .user(user)
                .category(category != null ? category : "기타")
                .itemType(type != null ? type : "")
                .color(color != null ? color : "")
                .material(material)
                .styleTags(styleTags != null ? styleTags : "")
                .imageThumbnail(imageUrl)
                .build();


        wardrobeRepository.save(item);


        // =====================================================
        // 기존 MySQL 임베딩 저장
        // =====================================================

        if (embedding != null && !embedding.isEmpty()) {

            WardrobeEmbedding emb =
                    WardrobeEmbedding.builder()

                            .wardrobeItem(item)

                            .vectorData(embedding)

                            .modelName("fashion-clip")

                            .build();

            embeddingRepository.save(emb);
        }


        // =====================================================
        // ChromaDB 임베딩 등록
        // =====================================================

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

                log.warn(
                        "ChromaDB 임베딩 등록 실패 (itemId={}): {}",
                        item.getItemId(),
                        e.getMessage()
                );
            }
        }


        return new WardrobeItemResponse(item);
    }


    // =========================================================
    // 옷 삭제
    // =========================================================

    @Transactional
    public void deleteItem(
            String userId,
            String itemId) {

        User user = getUser(userId);

        WardrobeItem item =
                wardrobeRepository
                        .findById(itemId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "아이템 없음"
                                )
                        );


        if (!item.getUser()
                .getUserId()
                .equals(user.getUserId())) {

            throw new IllegalArgumentException(
                    "삭제 권한 없음"
            );
        }


        wardrobeRepository.delete(item);


        try {

            aiService.deleteEmbedding(itemId);

        } catch (Exception e) {

            log.warn(
                    "ChromaDB 임베딩 삭제 실패 (itemId={}): {}",
                    itemId,
                    e.getMessage()
            );
        }
    }


    // =========================================================
    // 옷 수정
    // =========================================================

    @Transactional
    public void updateItem(
            String userId,
            String itemId,
            Map<String, String> body) {

        User user =
                userRepository
                        .findByUserId(userId)
                        .orElseThrow(
                                () -> new RuntimeException(
                                        "사용자 없음"
                                )
                        );


        WardrobeItem item =
                wardrobeRepository
                        .findById(itemId)
                        .orElseThrow(
                                () -> new RuntimeException(
                                        "아이템 없음"
                                )
                        );


        if (!item.getUser()
                .getUserId()
                .equals(user.getUserId())) {

            throw new RuntimeException(
                    "권한 없음"
            );
        }


        if (body.containsKey("category")) {

            item.setCategory(
                    body.get("category")
            );
        }


        if (body.containsKey("type")) {

            item.setItemType(
                    body.get("type")
            );
        }


        if (body.containsKey("color")) {

            item.setColor(
                    body.get("color")
            );
        }


        if (body.containsKey("material")) {

            item.setMaterial(
                    body.get("material")
            );
        }


        wardrobeRepository.save(item);
    }
}