package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "recommendation_item")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RecommendationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rec_item_id")
    private Integer recItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rec_id", nullable = false)
    private Recommendation recommendation;

    @Column(name = "order_num", nullable = false)
    private Integer orderNum;

    @Column(nullable = false, length = 10)
    private String category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_wardrobe_id")
    private WardrobeItem matchedWardrobeItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ref_fashion_id")
    private FashionDbItem refFashionItem;

    @Column(name = "similarity_score")
    private Float similarityScore;

    // ── 신규 ──────────────────────────────────
    @Column(name = "outfit_index", nullable = false)
    private Integer outfitIndex = 0;
    // ─────────────────────────────────────────
}