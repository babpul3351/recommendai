package com.capstone.recommendai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    // 코디 합성 전용 실행기.
    // SAM 모델이 무겁고(특히 맥북 서버) 한 번에 하나씩만 돌리는 편이 안전하므로 스레드 1개 + 대기열로 순서대로 처리.
    // 단일 스레드라서 같은 추천을 연달아 선택해도 선택한 순서대로 처리.
    @Bean(name = "compositeExecutor")
    public Executor compositeExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("outfit-composite-");
        executor.initialize();
        return executor;
    }
}
