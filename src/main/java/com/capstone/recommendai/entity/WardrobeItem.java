package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wardrobe_item")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
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

    // [신규] 사용자가 직접 지정한 계절: summer / winter / mid / all. null이면 이름 키워드로 자동 분류
    @Column(length = 10)
    private String season;

    @Column(name = "image_thumbnail", length = 500)
    private String imageThumbnail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToOne(mappedBy = "wardrobeItem",
            cascade = CascadeType.ALL, orphanRemoval = true)
    private WardrobeEmbedding embedding;

    @PrePersist
    public void prePersist() {
        if (this.itemId == null) {
            this.itemId = UUID.randomUUID().toString();
        }
        this.createdAt = LocalDateTime.now();
    }
}