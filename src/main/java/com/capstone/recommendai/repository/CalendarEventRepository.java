package com.capstone.recommendai.repository;

import com.capstone.recommendai.entity.CalendarEvent;
import com.capstone.recommendai.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, String> {
    List<CalendarEvent> findByUserOrderByEventDatetimeAsc(User user);
}