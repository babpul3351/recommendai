package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wardrobe_embedding")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WardrobeEmbedding {

    @Id
    @Column(name = "item_id", length = 36)
    private String itemId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "item_id")
    private WardrobeItem wardrobeItem;

    @Column(name = "vector_data", nullable = false, columnDefinition = "TEXT")
    private String vectorData;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}