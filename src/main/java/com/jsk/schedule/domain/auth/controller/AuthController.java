package com.jsk.schedule.domain.auth.controller;

import com.jsk.schedule.domain.auth.dto.KakaoLoginRequest;
import com.jsk.schedule.domain.auth.dto.LoginRequest;
import com.jsk.schedule.domain.auth.dto.LoginResponse;
import com.jsk.schedule.domain.auth.dto.TokenReissueRequest;
import com.jsk.schedule.domain.auth.service.AuthService;
import com.jsk.schedule.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * ID/PW 로그인
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Access Token 재발급 (Token Rotation 정책).
     * Refresh Token으로 새 Access Token + Refresh Token을 발급한다.
     */
    @PostMapping("/reissue")
    public ResponseEntity<ApiResponse<LoginResponse>> reissue(@Valid @RequestBody TokenReissueRequest request) {
        log.info("토큰 재발급 요청 수신");
        LoginResponse response = authService.reissue(request.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 카카오 OAuth 콜백.
     * Authorization Code를 받아 JWT 토큰 발급 및 사용자 자동 가입 처리.
     */
    @PostMapping("/kakao/callback")
    public ResponseEntity<ApiResponse<LoginResponse>> kakaoCallback(@Valid @RequestBody KakaoLoginRequest request) {
        log.info("카카오 OAuth 콜백 요청 수신");
        LoginResponse response = authService.kakaoLogin(request.getCode());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
