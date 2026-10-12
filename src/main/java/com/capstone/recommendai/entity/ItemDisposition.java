package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 유휴 의류에 대한 사용자의 처분 의사 기록. 아이템당 한 행(덮어쓰기).
 * decision: KEEP(계속 활용) / RESELL(중고거래) / DONATE(기부) / DISCARD(정리)
 * keepCount: KEEP을 선택한 누적 횟수 (재제안 안내 문구에 사용)
 * 외부 연동은 없으며 사용자의 의사만 기록.
 */
@Entity
@Table(name = "item_disposition")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ItemDisposition {

    @Id
    @Column(name = "item_id", length = 36)
    private String itemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false, length = 10)
    private String decision;

    @Column(name = "keep_count", nullable = false)
    private int keepCount;

    @Column(name = "decided_at", nullable = false)
    private LocalDateTime decidedAt;

    @Column(name = "listing_title", length = 100)
    private String listingTitle;

    @Column(name = "listing_body", columnDefinition = "TEXT")
    private String listingBody;
}