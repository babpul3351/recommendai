package com.capstone.recommendai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "calendar_event")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CalendarEvent {

    @Id
    @Column(name = "event_id", length = 36)
    private String eventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "event_name", nullable = false, length = 100)
    private String eventName;

    @Column(name = "event_datetime", nullable = false)
    private LocalDateTime eventDatetime;

    @Column(name = "tpo_keyword", length = 20)
    private String tpoKeyword;

    @Column(nullable = false, length = 20)
    private String source;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.eventId == null) {
            this.eventId = UUID.randomUUID().toString();
        }
        if (this.source == null) {
            this.source = "manual";
        }
        this.createdAt = LocalDateTime.now();
    }
}