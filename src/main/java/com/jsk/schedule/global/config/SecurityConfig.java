package com.jsk.schedule.global.config;

import com.jsk.schedule.global.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CorsConfigurationSource corsConfigurationSource;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CSRF 비활성화 (JWT Stateless 방식 사용)
            .csrf(AbstractHttpConfigurer::disable)

            // CORS 설정 적용
            .cors(cors -> cors.configurationSource(corsConfigurationSource))

            // 세션 사용 안 함 (STATELESS)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // 요청 권한 설정
            .authorizeHttpRequests(auth -> auth
                // 인증 없이 허용할 경로
                .requestMatchers("/api/auth/**").permitAll()
                // 일정 조회는 비인증 사용자도 가능 (설계서 4.5 - 비소속 사용자 조회)
                .requestMatchers(HttpMethod.GET, "/api/teams/*/schedules").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/teams/*/schedules/*").permitAll()
                // 팀원 목록, 팀 상세, 내 팀 목록은 인증된 사용자만 조회 가능
                .requestMatchers(HttpMethod.GET, "/api/teams").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/teams/*").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/teams/*/members").authenticated()
                // 나머지 모든 요청은 인증 필요
                .anyRequest().authenticated()
            );

        // JWT 인증 필터를 UsernamePasswordAuthenticationFilter 앞에 등록
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
