package com.capstone.recommendai.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

/**
 * 배경 제거(누끼) 중계 API.
 *
 * 브라우저 → Spring(/api/wardrobe/remove-background, JWT 인증) → FastAPI(/ai/remove-background)
 *
 * 이전에는 브라우저가 FastAPI(8000)를 직접 호출했다. 배포 환경에서는 FastAPI를 외부에 공개하지 않으므로
 * Spring이 로그인 여부를 확인한 뒤 대신 호출한다. 인증은 SecurityConfig의 anyRequest().authenticated()가 처리한다.
 */
@RestController
@RequestMapping("/api/wardrobe")
public class BackgroundRemovalController {

    // SAM 추론이 오래 걸릴 수 있어 무한 대기를 막기 위해 별도 타임아웃을 둔다.
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(120);

    private final String aiServerUrl;
    private final RestTemplate aiRestTemplate;

    public BackgroundRemovalController(@Value("${ai.server.url}") String aiServerUrl) {
        this.aiServerUrl = aiServerUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT);
        factory.setReadTimeout(READ_TIMEOUT);
        this.aiRestTemplate = new RestTemplate(factory);
    }

    @PostMapping("/remove-background")
    public ResponseEntity<?> removeBackground(@RequestBody Map<String, Object> body) {
        Object imageB64 = (body == null) ? null : body.get("imageB64");
        if (!(imageB64 instanceof String image) || image.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "imageB64가 필요합니다."));
        }

        try {
            Map<?, ?> result = aiRestTemplate.postForObject(
                    aiServerUrl + "/ai/remove-background",
                    Map.of("imageB64", image),
                    Map.class);
            if (result == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("error", "AI 서버 응답이 비어 있습니다."));
            }
            return ResponseEntity.ok(result);
        } catch (HttpStatusCodeException e) {
            // AI 서버의 상세 오류 메시지(내부 정보)는 브라우저로 그대로 넘기지 않는다.
            System.err.println("배경 제거 실패(AI 서버 응답 " + e.getStatusCode() + "): " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "배경 제거에 실패했습니다."));
        } catch (ResourceAccessException e) {
            System.err.println("배경 제거 실패(AI 서버 연결/시간 초과): " + e.getMessage());
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body(Map.of("error", "AI 서버에 연결할 수 없습니다."));
        }
    }
}