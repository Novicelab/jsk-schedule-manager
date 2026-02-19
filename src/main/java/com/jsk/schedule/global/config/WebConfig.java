package com.jsk.schedule.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * WebClient 빈 설정.
 * 외부 HTTP 클라이언트(카카오 API 등)에서 DI로 주입받아 사용한다.
 * 직접 생성(new WebClient.builder().build()) 대신 빈을 주입받으면 테스트 시 Mock으로 교체 가능하다.
 */
@Configuration
public class WebConfig {

    private static final Duration DEFAULT_RESPONSE_TIMEOUT = Duration.ofSeconds(10);

    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(1024 * 1024))
                .build();
    }
}
