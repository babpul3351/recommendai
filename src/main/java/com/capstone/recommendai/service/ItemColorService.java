package com.capstone.recommendai.service;

/*
 * [신규] 옷장 아이템 대표 색 계산 (백그라운드)
 * -----------------------------------------
 * - 아직 v2 색이 없는 아이템(dominant_colors가 null이거나 v1 형식)을 하나씩 AI 서버(/ai/item-colors)로 보내
 *   YOLO + SAM 누끼로 그 옷만 잘라낸 색을 계산하고 DB에 "v2|#AABBCC:0.62,..." 형식으로 저장한다.
 * - SAM이 무거워서 전용 실행기(itemColorExecutor, 스레드 1개)에서 순서대로 처리한다.
 * - 같은 사용자에 대해 이미 실행 중(또는 대기 중)이면 다시 시작하지 않는다.
 *
 * 적용 위치: src/main/java/com/capstone/recommendai/service/ItemColorService.java (신규 파일)
 */

import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ItemColorService {

    public static final String VERSION = "v2|";
    private static final int ITEM_IMAGE_MAX_SIDE = 640;   // SAM 입력용. (SAM은 내부에서 1024로 맞춤)
    private static final Pattern FORMAT =
            Pattern.compile("^v2\\|(none|#[0-9A-Fa-f]{6}:[0-9.]+(,#[0-9A-Fa-f]{6}:[0-9.]+){0,4})$");

    private final String aiServerUrl;
    private final UserRepository userRepository;
    private final WardrobeRepository wardrobeRepository;
    private final RestTemplate restTemplate;      // S3 이미지 다운로드용 (기존 빈)
    private final RestTemplate aiRestTemplate;    // SAM 추론 대기용 타임아웃
    private final TransactionTemplate tx;
    private final Set<String> running = ConcurrentHashMap.newKeySet();

    public ItemColorService(@Value("${ai.server.url}") String aiServerUrl,
                            UserRepository userRepository,
                            WardrobeRepository wardrobeRepository,
                            RestTemplate restTemplate,
                            PlatformTransactionManager transactionManager) {
        this.aiServerUrl = aiServerUrl;
        this.userRepository = userRepository;
        this.wardrobeRepository = wardrobeRepository;
        this.restTemplate = restTemplate;
        this.tx = new TransactionTemplate(transactionManager);
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(120));   // 실측 없이 잡은 상한 (아이템 1개 기준)
        this.aiRestTemplate = new RestTemplate(factory);
    }

    public static boolean isAnalyzed(WardrobeItem item) {
        String v = item.getDominantColors();
        return v != null && v.startsWith(VERSION);
    }

    private static boolean hasImage(WardrobeItem item) {
        return item.getImageThumbnail() != null && !item.getImageThumbnail().isBlank();
    }

    /** 실행 중 표시를 먼저 남김. 이미 실행/대기 중이면 false. (호출 쪽에서 true일 때만 analyzeMissing 호출) */
    public boolean tryMarkRunning(String userId) {
        return running.add(userId);
    }

    public void unmarkRunning(String userId) {
        running.remove(userId);
    }

    public Map<String, Object> status(String userId, List<WardrobeItem> items) {
        int total = 0, analyzed = 0;
        for (WardrobeItem it : items) {
            if (!hasImage(it)) continue;
            total++;
            if (isAnalyzed(it)) analyzed++;
        }
        Map<String, Object> m = new HashMap<>();
        m.put("total", total);
        m.put("analyzed", analyzed);
        m.put("running", running.contains(userId));
        return m;
    }

    public Map<String, Object> status(String userId) {
        User user = userRepository.findByUserId(userId).orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
        return status(userId, wardrobeRepository.findByUser(user));
    }

    /** 색이 없는(또는 v1 형식인) 아이템을 순서대로 계산. tryMarkRunning(userId)가 true였을 때만 호출할 것. */
    @Async("itemColorExecutor")
    public void analyzeMissing(String userId) {
        try {
            User user = userRepository.findByUserId(userId).orElse(null);
            if (user == null) return;
            List<WardrobeItem> items = wardrobeRepository.findByUser(user);
            int done = 0;
            for (WardrobeItem it : items) {
                if (isAnalyzed(it) || !hasImage(it)) continue;
                String colors = analyzeOne(it);
                if (colors != null) {
                    save(it.getItemId(), colors);
                    done++;
                }
            }
            log.info("[item-colors] user={} 새로 계산 {}개", userId, done);
        } catch (Exception e) {
            log.error("[item-colors] 백그라운드 계산 실패 user={}: {}", userId, e.toString());
        } finally {
            running.remove(userId);
        }
    }

    private String analyzeOne(WardrobeItem item) {
        String image = downloadAsJpegDataUrl(item.getImageThumbnail(), ITEM_IMAGE_MAX_SIDE);
        if (image == null) return null;   // 다음 요청 때 다시 시도
        try {
            Map<String, String> body = new HashMap<>();
            body.put("imageB64", image);
            body.put("category", item.getCategory() == null ? "" : item.getCategory());
            Map<?, ?> res = aiRestTemplate.postForObject(aiServerUrl + "/ai/item-colors", body, Map.class);
            Object colors = res == null ? null : res.get("colors");
            if (colors instanceof String s && s.length() <= 100 && FORMAT.matcher(s).matches()) {
                return s;
            }
            log.warn("[item-colors] 형식이 맞지 않는 응답 item={}: {}", item.getItemId(), colors);
        } catch (Exception e) {
            log.warn("[item-colors] AI 서버 호출 실패 item={}: {}", item.getItemId(), e.toString());
        }
        return null;
    }

    private void save(String itemId, String colors) {
        try {
            tx.executeWithoutResult(status ->
                    wardrobeRepository.findById(itemId).ifPresent(w -> w.setDominantColors(colors)));
        } catch (Exception e) {
            log.warn("[item-colors] 저장 실패 item={}: {}", itemId, e.toString());
        }
    }

    /** S3 원본을 내려받아 긴 변 maxSide px JPEG(data URL)로 줄인다. 읽을 수 없는 형식이면 원본 그대로, 실패하면 null. */
    String downloadAsJpegDataUrl(String url, int maxSide) {
        try {
            byte[] bytes = restTemplate.getForObject(url, byte[].class);
            if (bytes == null || bytes.length == 0) return null;
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(bytes));
            if (src == null) {
                return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(bytes);
            }
            double scale = Math.min(1.0, (double) maxSide / Math.max(src.getWidth(), src.getHeight()));
            int w = Math.max(1, (int) Math.round(src.getWidth() * scale));
            int h = Math.max(1, (int) Math.round(src.getHeight() * scale));
            BufferedImage dst = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = dst.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, w, h, java.awt.Color.WHITE, null);   // 투명 PNG는 흰 배경으로
            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(dst, "jpg", out);
            return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception e) {
            log.warn("[item-colors] 이미지 다운로드 실패: {} ({})", url, e.toString());
            return null;
        }
    }
}