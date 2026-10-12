package com.capstone.recommendai.service;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.RecommendationItem;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.event.OutfitAcceptedEvent;
import com.capstone.recommendai.repository.RecommendationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 사용자가 선택(저장)한 코디만 누끼를 따서 흰 배경에 합성하고, 결과 이미지를 S3에 저장해 recommendation에 URL을 보관.
 * - 옷장 원본 이미지는 건드리지 XX. (옷장 화면은 계속 원본을 보여줌)
 * - 선택(accept) 요청은 바로 성공 응답하고, 합성은 커밋 이후 별도 스레드에서 처리.
 * - 합성이 실패해도 코디 선택 자체는 유지. (status = FAILED)
 */
@Slf4j
@Service
public class OutfitCompositeService {

    public static final String PENDING = "PENDING";
    public static final String DONE = "DONE";
    public static final String FAILED = "FAILED";
    public static final String SKIPPED = "SKIPPED";   // 합성할 수 있는 (옷장과 매칭된) 아이템이 없음

    private static final String S3_FOLDER = "outfit-composite";

    private final RecommendationRepository recommendationRepository;
    private final AIService aiService;
    private final S3Service s3Service;
    private final RestTemplate restTemplate;
    private final TransactionTemplate tx;

    public OutfitCompositeService(RecommendationRepository recommendationRepository,
                                  AIService aiService,
                                  S3Service s3Service,
                                  RestTemplate restTemplate,
                                  PlatformTransactionManager transactionManager) {
        this.recommendationRepository = recommendationRepository;
        this.aiService = aiService;
        this.s3Service = s3Service;
        this.restTemplate = restTemplate;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** 코디 선택이 커밋된 뒤 별도 스레드에서 실행됩니다. */
    @Async("compositeExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOutfitAccepted(OutfitAcceptedEvent event) {
        generate(event.recId(), event.outfitIndex(), event.previousCompositeUrl());
    }

    /** 동기 실행용 진입점 (테스트나 수동 재생성에서 사용 가능) */
    public void generate(String recId, int outfitIndex, String previousUrl) {
        String newUrl = null;
        String status = FAILED;
        try {
            List<ItemSource> sources = tx.execute(s -> collectItems(recId, outfitIndex));
            if (sources == null) {
                // 그 사이 다른 코디로 바뀌었거나 추천이 삭제됨 -> 이 작업은 의미 없음
                log.info("[composite] 건너뜀(이미 다른 코디 선택됨 또는 추천 없음): rec={}, idx={}", recId, outfitIndex);
                deleteQuietly(previousUrl);
                return;
            }

            List<Map<String, String>> requestItems = downloadAsRequestItems(sources);
            if (sources.isEmpty() || requestItems.isEmpty()) {
                status = sources.isEmpty() ? SKIPPED : FAILED;
                log.info("[composite] 합성할 이미지가 없습니다: rec={}, status={}", recId, status);
            } else {
                Map result = aiService.composeOutfit(requestItems);
                String imageB64 = result == null ? null : (String) result.get("imageB64");
                if (imageB64 == null || imageB64.isEmpty()) {
                    throw new IllegalStateException("AI 서버가 합성 이미지를 돌려주지 않았습니다.");
                }
                newUrl = s3Service.uploadBase64Image(imageB64, S3_FOLDER);
                status = DONE;
                log.info("[composite] 완료: rec={}, items={}", recId, result.get("items"));
            }
        } catch (Exception e) {
            log.error("[composite] 합성 실패: rec={}, idx={}, {}", recId, outfitIndex, e.toString());
            status = FAILED;
            newUrl = null;
        }

        saveResult(recId, outfitIndex, newUrl, status, previousUrl);
    }

    // ── 내부 구현 ──────────────────────────────────────────────

    private record ItemSource(String category, String imageUrl) {
    }

    /** 선택된 코디(outfitIndex)의 옷장 매칭 아이템을 (카테고리, 원본 이미지 URL)로 모읍니다. 이미 다른 코디로 바뀌었으면 null. */
    private List<ItemSource> collectItems(String recId, int outfitIndex) {
        Recommendation rec = recommendationRepository.findById(recId).orElse(null);
        if (rec == null || !Objects.equals(rec.getAcceptedOutfitIndex(), outfitIndex)) {
            return null;
        }
        List<ItemSource> sources = new ArrayList<>();
        for (RecommendationItem item : rec.getItems()) {
            if (!Objects.equals(item.getOutfitIndex(), outfitIndex)) continue;
            WardrobeItem wardrobe = item.getMatchedWardrobeItem();
            // 옷장과 매칭되지 않은 슬롯(참고용 이미지만 있는 경우)은 합성에서 제외
            if (wardrobe == null || wardrobe.getImageThumbnail() == null || wardrobe.getImageThumbnail().isBlank()) continue;
            // 사용자가 옷장에서 고친 카테고리를 우선 사용하고, 비어 있으면 추천 아이템의 카테고리를 씁니다.
            String category = wardrobe.getCategory() != null && !wardrobe.getCategory().isBlank()
                    ? wardrobe.getCategory() : item.getCategory();
            sources.add(new ItemSource(category, wardrobe.getImageThumbnail()));
        }
        return sources;
    }

    /** 원본 이미지를 내려받아 AI 서버 요청 형식으로 만듭니다. 내려받기에 실패한 아이템은 건너뜁니다. */
    private List<Map<String, String>> downloadAsRequestItems(List<ItemSource> sources) {
        List<Map<String, String>> items = new ArrayList<>();
        for (ItemSource src : sources) {
            try {
                byte[] bytes = restTemplate.getForObject(src.imageUrl(), byte[].class);
                if (bytes == null || bytes.length == 0) continue;
                Map<String, String> m = new HashMap<>();
                m.put("category", src.category());
                m.put("imageB64", Base64.getEncoder().encodeToString(bytes));
                items.add(m);
            } catch (Exception e) {
                log.warn("[composite] 이미지 다운로드 실패, 해당 아이템 제외: {} ({})", src.imageUrl(), e.toString());
            }
        }
        return items;
    }

    /** 결과를 DB에 반영합니다. 그 사이 다른 코디가 선택됐다면 이번 결과(새 S3 파일)는 버립니다. */
    private void saveResult(String recId, int outfitIndex, String newUrl, String status, String previousUrl) {
        String[] replaced = new String[1];
        Boolean applied;
        try {
            applied = tx.execute(s -> {
                Recommendation rec = recommendationRepository.findById(recId).orElse(null);
                if (rec == null || !Objects.equals(rec.getAcceptedOutfitIndex(), outfitIndex)) {
                    return false;
                }
                replaced[0] = rec.getCompositeImageUrl();   // 같은 코디를 연달아 선택한 경우 먼저 끝난 결과 파일
                rec.setCompositeImageUrl(newUrl);
                rec.setCompositeStatus(status);
                recommendationRepository.save(rec);
                return true;
            });
        } catch (Exception e) {
            log.error("[composite] 결과 저장 실패: rec={}, {}", recId, e.toString());
            applied = false;
        }

        if (!Boolean.TRUE.equals(applied)) {
            deleteQuietly(newUrl);   // 아무도 참조하지 않는 새 파일
        }
        deleteQuietly(previousUrl);
        if (replaced[0] != null && !replaced[0].equals(newUrl)) {
            deleteQuietly(replaced[0]);
        }
    }

    private void deleteQuietly(String url) {
        if (url == null || url.isBlank()) return;
        try {
            s3Service.deleteImage(url);
        } catch (Exception e) {
            log.warn("[composite] S3 삭제 실패: {} ({})", url, e.toString());
        }
    }
}
