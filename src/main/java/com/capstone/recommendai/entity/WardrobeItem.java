package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wardrobe_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WardrobeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String category;   // 상의, 하의, 아우터, 원피스
    private String type;       // 티셔츠, 청바지 등
    private String color;
    private String material;

    @Column(columnDefinition = "LONGTEXT")
    private String imageB64;   // base64 이미지

    @Column(columnDefinition = "LONGTEXT")
    private String embedding;  // CLIP 임베딩 JSON

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}