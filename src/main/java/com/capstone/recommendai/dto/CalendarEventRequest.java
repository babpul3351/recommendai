package com.capstone.recommendai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class CalendarEventRequest {

    @NotBlank(message = "일정명을 입력해주세요")
    private String eventName;

    @NotNull(message = "일정 일시를 입력해주세요")
    private String eventDatetime;  // "2026-05-01T09:00:00" 형식

    private String tpoKeyword;

    private String source = "manual";
}