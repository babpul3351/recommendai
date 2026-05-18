package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "recommendation")
@Getter @Setter
@NoArgsConstructor
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

    @Column(length = 20)
    private String style;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "outfit_date")
    private java.time.LocalDate outfitDate;

    @OneToMany(mappedBy = "recommendation",
            cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecommendationItem> items = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.recId == null) {
            this.recId = UUID.randomUUID().toString();
        }
        this.createdAt = LocalDateTime.now();
    }

    // @Builder와 함께 AllArgsConstructor 대신 직접 생성자 추가
    public Recommendation(String recId, User user, CalendarEvent calendarEvent,
                          Integer temperature, String weatherCondition,
                          String tpo, String style, String description,
                          LocalDateTime createdAt, java.time.LocalDate outfitDate,
                          List<RecommendationItem> items) {
        this.recId = recId;
        this.user = user;
        this.calendarEvent = calendarEvent;
        this.temperature = temperature;
        this.weatherCondition = weatherCondition;
        this.tpo = tpo;
        this.style = style;
        this.description = description;
        this.createdAt = createdAt;
        this.outfitDate = outfitDate;
        this.items = items != null ? items : new ArrayList<>();
    }
}