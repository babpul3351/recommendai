package com.capstone.recommendai.controller;

import com.capstone.recommendai.dto.CalendarEventRequest;
import com.capstone.recommendai.dto.CalendarEventResponse;
import com.capstone.recommendai.service.CalendarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendarService;

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

    // 일정 삭제
    @DeleteMapping("/{eventId}")
    public ResponseEntity<String> deleteEvent(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String eventId) {
        calendarService.deleteEvent(userDetails.getUsername(), eventId);
        return ResponseEntity.ok("삭제되었습니다");
    }
}