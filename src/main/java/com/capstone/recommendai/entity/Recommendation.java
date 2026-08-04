package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "recommendation")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recommendation {

    @Id
    @Column(name = "rec_id", length = 36)
    private String recId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private CalendarEvent calendarEvent;

    @Column
    private Integer temperature;

    @Column(name = "weather_condition", length = 30)
    private String weatherCondition;

    @Column(nullable = false, length = 20)
    private String tpo;

    @Column(length = 100)
    private String style;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "outfit_date")
    private LocalDate outfitDate;

    // ── 신규 ──────────────────────────────────
    @Column(name = "accepted_outfit_index")
    private Integer acceptedOutfitIndex;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Column(name = "parent_rec_id", length = 36)
    private String parentRecId;
    // ─────────────────────────────────────────

    @OneToMany(mappedBy = "recommendation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecommendationItem> items = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.recId == null) this.recId = UUID.randomUUID().toString();
        this.createdAt = LocalDateTime.now();
        if (this.retryCount == null) this.retryCount = 0;
    }

    @Column(name = "outfits_json", columnDefinition = "TEXT")
    private String outfitsJson;
}