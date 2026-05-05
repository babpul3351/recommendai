package com.capstone.recommendai.dto;

import com.capstone.recommendai.entity.CalendarEvent;
import lombok.Getter;

@Getter
public class CalendarEventResponse {
    private String eventId;
    private String eventName;
    private String eventDatetime;
    private String tpoKeyword;
    private String source;
    private String createdAt;

    public CalendarEventResponse(CalendarEvent event) {
        this.eventId       = event.getEventId();
        this.eventName     = event.getEventName();
        this.eventDatetime = event.getEventDatetime().toString();
        this.tpoKeyword    = event.getTpoKeyword();
        this.source        = event.getSource();
        this.createdAt     = event.getCreatedAt().toString();
    }
}