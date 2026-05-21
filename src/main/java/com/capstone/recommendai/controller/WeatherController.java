package com.capstone.recommendai.controller;

import com.capstone.recommendai.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    // 기본 서울 날씨 조회
    @GetMapping
    public ResponseEntity<Map<String, Object>> getWeather() {
        return ResponseEntity.ok(
                weatherService.getCurrentWeather("Seoul", "KR")
        );
    }

    // 도시 지정 날씨 조회
    @GetMapping("/{city}")
    public ResponseEntity<Map<String, Object>> getWeatherByCity(
            @PathVariable String city) {
        return ResponseEntity.ok(
                weatherService.getCurrentWeather(city, "KR")
        );
    }

    // 특정 날짜 날씨 조회 (5일 이내)
    @GetMapping("/forecast")
    public ResponseEntity<?> getForecast(@RequestParam String date) {
        try {
            Map<String, Object> weather = weatherService.getWeatherByDate("Seoul", "KR", date);
            return ResponseEntity.ok(weather);
        } catch (Exception e) {
            return ResponseEntity.ok(weatherService.getCurrentWeather("Seoul", "KR"));
        }
    }
}