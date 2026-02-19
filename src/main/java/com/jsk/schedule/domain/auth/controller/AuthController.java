package com.jsk.schedule.domain.auth.controller;

import com.jsk.schedule.domain.auth.dto.LoginResponse;
import com.jsk.schedule.domain.auth.dto.TokenReissueRequest;
import com.jsk.schedule.domain.auth.service.AuthService;
import com.jsk.schedule.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 인증 관련 API 컨트롤러.
 * 카카오 OAuth 로그인, 토큰 재발급, 로그아웃 엔드포인트를 제공한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/kakao/callback
     * 카카오 Authorization Code로 로그인/회원가입 처리.
     * 미가입 사용자는 자동 회원가입 후 로그인된다.
     */
    @PostMapping("/kakao/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LoginResponse> kakaoLogin(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        LoginResponse response = authService.login(code);
        return ApiResponse.success(response);
    }

    /**
     * POST /api/auth/reissue
     * Refresh Token으로 새 Access Token 및 Refresh Token을 재발급한다 (Rotation).
     */
    @PostMapping("/reissue")
    public ApiResponse<LoginResponse> reissue(@Valid @RequestBody TokenReissueRequest request) {
        LoginResponse response = authService.reissue(request.getRefreshToken());
        return ApiResponse.success(response);
    }

    /**
     * POST /api/auth/logout
     * Refresh Token을 무효화하여 로그아웃 처리한다.
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody TokenReissueRequest request) {
        authService.logout(request.getRefreshToken());
        return ApiResponse.success();
    }
}
