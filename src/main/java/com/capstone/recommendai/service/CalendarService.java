package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.CalendarEventRequest;
import com.capstone.recommendai.dto.CalendarEventResponse;
import com.capstone.recommendai.entity.CalendarEvent;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.repository.CalendarEventRepository;
import com.capstone.recommendai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalendarService {

    private final CalendarEventRepository calendarEventRepository;
    private final UserRepository userRepository;

    private User getUser(String userId) {
        return userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
    }

    // 일정 전체 조회
    public List<CalendarEventResponse> getEvents(String userId) {
        User user = getUser(userId);
        return calendarEventRepository.findByUserOrderByEventDatetimeAsc(user)
                .stream()
                .map(CalendarEventResponse::new)
                .collect(Collectors.toList());
    }

    // 일정 추가
    @Transactional
    public CalendarEventResponse addEvent(String userId, CalendarEventRequest req) {
        User user = getUser(userId);

        CalendarEvent event = CalendarEvent.builder()
                .user(user)
                .eventName(req.getEventName())
                .eventDatetime(LocalDateTime.parse(req.getEventDatetime()))
                .tpoKeyword(req.getTpoKeyword())
                .source(req.getSource() != null ? req.getSource() : "manual")
                .build();

        calendarEventRepository.save(event);
        return new CalendarEventResponse(event);
    }

    // 일정 삭제
    @Transactional
    public void deleteEvent(String userId, String eventId) {
        User user = getUser(userId);
        CalendarEvent event = calendarEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("일정 없음"));

        if (!event.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("삭제 권한 없음");
        }

        calendarEventRepository.delete(event);
    }
}