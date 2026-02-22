package com.jsk.schedule.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:https://jsk-schedule-frontend.onrender.com}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // 환경 변수에서 여러 origin을 콤마로 구분하여 설정
        List<String> origins = List.of(allowedOrigins.split(",\\s*"));
        configuration.setAllowedOrigins(origins);

        // 모든 HTTP 메서드 허용
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // 모든 헤더 허용
        configuration.setAllowedHeaders(List.of("*"));

        // 자격증명(쿠키, 인증헤더) 포함 허용
        configuration.setAllowCredentials(true);

        // Preflight 응답 캐시 시간 (1시간)
        configuration.setMaxAge(3600L);

        // 응답 헤더 노출
        configuration.setExposedHeaders(List.of("Authorization", "X-Total-Count"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
