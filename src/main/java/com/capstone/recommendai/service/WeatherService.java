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
}