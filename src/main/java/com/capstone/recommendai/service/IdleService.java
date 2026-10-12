package com.capstone.recommendai.service;

import com.capstone.recommendai.entity.ItemDisposition;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.WardrobeItem;
import com.capstone.recommendai.repository.ItemDispositionRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.WardrobeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 마이페이지 "의류 순환 리포트"의 유휴 의류 기능.
 * 외부 연동 없이 사용자의 처분 의사(계속 활용/중고거래/기부/정리)만 기록.
 */
@Service
@RequiredArgsConstructor
public class IdleService {

    public static final int IDLE_THRESHOLD_DAYS = 60;   // 설계값(검증되지 않음)
    public static final int KEEP_SNOOZE_DAYS = 90;      // 설계값(검증되지 않음)
    private static final Set<String> DECISIONS = Set.of("KEEP", "RESELL", "DONATE", "DISCARD");

    private final UserRepository userRepository;
    private final WardrobeRepository wardrobeRepository;
    private final ItemDispositionRepository dispositionRepository;
    private final AIService aiService;

    private User getUser(String username) {
        return userRepository.findByUserId(username)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    private WardrobeItem requireOwnedItem(User user, String itemId) {
        WardrobeItem item = wardrobeRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("아이템 없음"));
        if (!item.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("권한 없음");
        }
        return item;
    }

    /**
     * idleItems: status가 idle인 아이템 (KEEP 후 90일 이내인 것은 제외)
     * needsSeasonItems: 계절을 알 수 없어 사용자 확인이 필요한 아이템 (처분 권유 대상 아님)
     */
    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public Map<String, Object> getIdleItems(String username) {
        User user = getUser(username);
        Map<String, Object> result = aiService.idleAnalysis(user.getUserId(), IDLE_THRESHOLD_DAYS);
        List<Map<String, Object>> items = result == null
                ? new ArrayList<>()
                : (List<Map<String, Object>>) result.getOrDefault("items", new ArrayList<>());

        Map<String, ItemDisposition> dispositions = dispositionRepository.findByUserId(user.getUserId())
                .stream().collect(Collectors.toMap(ItemDisposition::getItemId, d -> d));

        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> idleItems = new ArrayList<>();
        List<Map<String, Object>> needsSeasonItems = new ArrayList<>();

        for (Map<String, Object> item : items) {
            String status = (String) item.get("status");
            String id = (String) item.get("id");

            if ("needs_season".equals(status)) {
                needsSeasonItems.add(new HashMap<>(item));
                continue;
            }
            if (!"idle".equals(status)) continue;

            Map<String, Object> row = new HashMap<>(item);
            row.put("decision", null);
            row.put("reSuggest", false);
            row.put("keepCount", 0);
            row.put("listingTitle", null);
            row.put("listingBody", null);

            ItemDisposition d = dispositions.get(id);
            if (d != null) {
                row.put("keepCount", d.getKeepCount());
                if ("KEEP".equals(d.getDecision())) {
                    if (d.getDecidedAt().plusDays(KEEP_SNOOZE_DAYS).isAfter(now)) {
                        continue; // 활용하기로 한 지 90일이 안 지났으면 숨김
                    }
                    row.put("reSuggest", true); // 다시 유휴로 분석됨 -> 정리 제안
                } else {
                    row.put("decision", d.getDecision());
                    row.put("listingTitle", d.getListingTitle());
                    row.put("listingBody", d.getListingBody());
                }
            }
            idleItems.add(row);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("idleItems", idleItems);
        out.put("needsSeasonItems", needsSeasonItems);
        out.put("thresholdDays", IDLE_THRESHOLD_DAYS);
        out.put("snoozeDays", KEEP_SNOOZE_DAYS);
        return out;
    }

    private Map<String, Object> itemSummary(WardrobeItem i) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", i.getItemId());
        m.put("category", i.getCategory());
        m.put("type", i.getItemType());
        m.put("color", i.getColor());
        m.put("imageUrl", i.getImageThumbnail());
        m.put("season", i.getSeason());
        return m;
    }

    /**
     * 전체 이력: 사용자가 기록한 활용 방식(처분 의사)과 직접 지정한 계절.
     * 계절은 현재 값만 저장되어 있어 변경 시각은 알 수 없음.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getHistory(String username) {
        User user = getUser(username);

        List<ItemDisposition> ds = new ArrayList<>(dispositionRepository.findByUserId(user.getUserId()));
        ds.sort(Comparator.comparing(ItemDisposition::getDecidedAt).reversed());

        List<Map<String, Object>> decisions = new ArrayList<>();
        for (ItemDisposition d : ds) {
            WardrobeItem item = wardrobeRepository.findById(d.getItemId()).orElse(null);
            if (item == null) continue;
            Map<String, Object> row = itemSummary(item);
            row.put("decision", d.getDecision());
            row.put("keepCount", d.getKeepCount());
            row.put("decidedAt", d.getDecidedAt().toString());
            row.put("listingTitle", d.getListingTitle());
            row.put("listingBody", d.getListingBody());
            decisions.add(row);
        }

        List<Map<String, Object>> seasons = wardrobeRepository.findByUser(user).stream()
                .filter(i -> i.getSeason() != null && !i.getSeason().isBlank())
                .map(this::itemSummary)
                .collect(Collectors.toList());

        Map<String, Object> out = new HashMap<>();
        out.put("decisions", decisions);
        out.put("seasons", seasons);
        out.put("snoozeDays", KEEP_SNOOZE_DAYS);
        return out;
    }

    @Transactional
    public Map<String, Object> decide(String username, String itemId, String decision) {
        if (decision == null || !DECISIONS.contains(decision)) {
            throw new IllegalArgumentException("잘못된 선택입니다.");
        }
        User user = getUser(username);
        requireOwnedItem(user, itemId);

        ItemDisposition d = dispositionRepository.findById(itemId).orElse(null);
        if (d == null) {
            d = ItemDisposition.builder().itemId(itemId).userId(user.getUserId()).keepCount(0).build();
        }
        if ("KEEP".equals(decision)) {
            d.setKeepCount(d.getKeepCount() + 1);
        }
        d.setDecision(decision);
        d.setDecidedAt(LocalDateTime.now());
        dispositionRepository.save(d);

        Map<String, Object> out = new HashMap<>();
        out.put("itemId", itemId);
        out.put("decision", decision);
        out.put("keepCount", d.getKeepCount());
        return out;
    }

    private static String clean(String s, int max) {
        if (s == null) return "";
        String t = s.replace("\n", " ").trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** 판매글 초안을 만들고 RESELL 의사와 함께 저장. 브랜드/사이즈/사용감/가격은 사용자가 준 값만 전달. */
    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> resaleDraft(String username, String itemId, Map<String, String> extra) {
        User user = getUser(username);
        WardrobeItem item = requireOwnedItem(user, itemId);

        Map<String, Object> req = new HashMap<>();
        req.put("category", clean(item.getCategory(), 20));
        req.put("type", clean(item.getItemType(), 50));
        req.put("color", clean(item.getColor(), 20));
        req.put("material", clean(item.getMaterial(), 30));
        Map<String, String> e = extra == null ? Collections.emptyMap() : extra;
        req.put("brand", clean(e.get("brand"), 40));
        req.put("size", clean(e.get("size"), 40));
        req.put("condition", clean(e.get("condition"), 80));
        req.put("price", clean(e.get("price"), 40));

        Map<String, Object> draft = aiService.resaleDraft(req);
        if (draft == null || draft.get("title") == null || draft.get("body") == null) {
            throw new IllegalStateException("판매글 초안 생성에 실패했습니다.");
        }

        ItemDisposition d = dispositionRepository.findById(itemId).orElse(null);
        if (d == null) {
            d = ItemDisposition.builder().itemId(itemId).userId(user.getUserId()).keepCount(0).build();
        }
        d.setDecision("RESELL");
        d.setDecidedAt(LocalDateTime.now());
        d.setListingTitle(clean(String.valueOf(draft.get("title")), 100));
        d.setListingBody(String.valueOf(draft.get("body")));
        dispositionRepository.save(d);

        return draft;
    }
}