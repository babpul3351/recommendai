package com.capstone.recommendai.controller;

import com.capstone.recommendai.dto.CalendarEventRequest;
import com.capstone.recommendai.dto.CalendarEventResponse;
import com.capstone.recommendai.service.AIService;
import com.capstone.recommendai.service.CalendarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendarService;
    private final AIService aiService;

    // 일정 전체 조회
    @GetMapping
    public ResponseEntity<List<CalendarEventResponse>> getEvents(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                calendarService.getEvents(userDetails.getUsername())
        );
    }

    // 일정 추가
    @PostMapping
    public ResponseEntity<CalendarEventResponse> addEvent(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CalendarEventRequest req) {
        return ResponseEntity.ok(
                calendarService.addEvent(userDetails.getUsername(), req)
        );
    }

    // [신규] 일정 제목만으로 TPO 자동 추천 (사용자가 그대로 쓰거나 드롭다운에서 바꿀 수 있음)
    @GetMapping("/suggest-tpo")
    public ResponseEntity<Map> suggestTpo(@RequestParam String eventName) {
        return ResponseEntity.ok(aiService.classifyTpo(eventName));
    }

    // 일정 삭제
    @DeleteMapping("/{eventId}")
    public ResponseEntity<String> deleteEvent(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String eventId) {
        calendarService.deleteEvent(userDetails.getUsername(), eventId);
        return ResponseEntity.ok("삭제되었습니다");
    }
}