package com.capstone.recommendai.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WeatherService {

    @Value("${weather.api.key}")
    private String apiKey;

    @Value("${weather.api.url}")
    private String apiUrl;

    private final RestTemplate restTemplate;

    public Map<String, Object> getCurrentWeather(String city, String country) {
        String url = apiUrl + "?q=" + city + "," + country
                + "&appid=" + apiKey
                + "&units=metric"
                + "&lang=kr";

        try {
            Map response = restTemplate.getForObject(url, Map.class);

            Map<String, Object> result = new HashMap<>();

            Map main = (Map) response.get("main");
            double temp = ((Number) main.get("temp")).doubleValue();
            result.put("temp", (int) Math.round(temp));

            List weatherList = (List) response.get("weather");
            Map weather = (Map) weatherList.get(0);
            result.put("desc", weather.get("description"));
            result.put("icon", weather.get("icon"));

            result.put("city", response.get("name"));
            result.put("country", country);
            result.put("humidity", main.get("humidity"));
            double feelsLike = ((Number) main.get("feels_like")).doubleValue();
            result.put("feelsLike", (int) Math.round(feelsLike));

            return result;

        } catch (Exception e) {
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("temp", 18);
            fallback.put("desc", "맑음");
            fallback.put("city", city);
            fallback.put("country", country);
            fallback.put("humidity", 50);
            fallback.put("feelsLike", 18);
            return fallback;
        }
    }

    // 5일 예보에서 특정 날짜 날씨 조회
    public Map<String, Object> getWeatherByDate(String city, String country, String targetDate) {
        try {
            String url = apiUrl.replace("/weather", "/forecast")
                    + "?q=" + city + "," + country
                    + "&appid=" + apiKey
                    + "&units=metric&lang=kr&cnt=40";

            Map response = restTemplate.getForObject(url, Map.class);
            if (response == null) return getDefaultWeather();

            List<Map<String, Object>> list = (List<Map<String, Object>>) response.get("list");
            if (list == null || list.isEmpty()) return getDefaultWeather();

            // targetDate (yyyy-MM-dd)에 해당하는 예보 찾기
            Map<String, Object> bestMatch = null;
            for (Map<String, Object> item : list) {
                String dtTxt = (String) item.get("dt_txt"); // "2026-05-18 12:00:00"
                if (dtTxt != null && dtTxt.startsWith(targetDate)) {
                    // 정오(12:00) 데이터 우선 사용
                    if (dtTxt.contains("12:00")) {
                        bestMatch = item;
                        break;
                    }
                    if (bestMatch == null) bestMatch = item;
                }
            }

            if (bestMatch == null) return getDefaultWeather();

            Map<String, Object> main = (Map<String, Object>) bestMatch.get("main");
            List<Map<String, Object>> weather = (List<Map<String, Object>>) bestMatch.get("weather");
            Map<String, Object> cityInfo = (Map<String, Object>) response.get("city");

            Map<String, Object> result = new HashMap<>();
            result.put("city", cityInfo != null ? cityInfo.get("name") : city);
            result.put("temp", main != null ? Math.round(((Number) main.get("temp")).doubleValue()) : 18);
            result.put("feelsLike", main != null ? Math.round(((Number) main.get("feels_like")).doubleValue()) : 18);
            result.put("humidity", main != null ? main.get("humidity") : 50);
            result.put("desc", weather != null && !weather.isEmpty() ? weather.get(0).get("description") : "맑음");
            return result;

        } catch (Exception e) {
            System.err.println("예보 날씨 조회 실패: " + e.getMessage());
            return getDefaultWeather();
        }
    }

    private Map<String, Object> getDefaultWeather() {
        Map<String, Object> result = new HashMap<>();
        result.put("city", "Seoul");
        result.put("temp", 18);
        result.put("feelsLike", 18);
        result.put("humidity", 50);
        result.put("desc", "맑음");
        return result;
    }
}