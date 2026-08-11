package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wardrobe_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WardrobeItem {

    @Id
    @Column(name = "item_id", length = 36)
    private String itemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 10)
    private String category;

    @Column(name = "item_type", nullable = false, length = 50)
    private String itemType;

    @Column(nullable = false, length = 20)
    private String color;

    @Column(length = 30)
    private String material;

    /*
     * Gemini Vision이 분석한 스타일 태그
     *
     * 예:
     * "캐주얼,스트릿"
     * "미니멀,모던"
     */
    @Column(name = "style_tags", columnDefinition = "TEXT")
    private String styleTags;

    @Column(name = "image_thumbnail", length = 500)
    private String imageThumbnail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToOne(
            mappedBy = "wardrobeItem",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private WardrobeEmbedding embedding;

    @PrePersist
    public void prePersist() {

        if (this.itemId == null) {
            this.itemId = UUID.randomUUID().toString();
        }

        this.createdAt = LocalDateTime.now();
    }
}