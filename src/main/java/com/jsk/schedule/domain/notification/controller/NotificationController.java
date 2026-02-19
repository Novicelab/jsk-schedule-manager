package com.jsk.schedule.domain.notification.controller;

import com.jsk.schedule.domain.notification.dto.NotificationResponse;
import com.jsk.schedule.domain.notification.service.NotificationService;
import com.jsk.schedule.global.common.ApiResponse;
import com.jsk.schedule.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 알림 조회 API 컨트롤러.
 * 인증된 사용자만 접근 가능 (SecurityConfig의 anyRequest().authenticated() 적용).
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * 내 알림 이력 조회.
     * GET /api/notifications/me
     *
     * @param userDetails 인증된 사용자 정보 (JWT 기반)
     * @return 알림 이력 목록 (최신순)
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.debug("내 알림 목록 조회 요청: userId={}", userDetails.userId());
        List<NotificationResponse> notifications =
                notificationService.getMyNotifications(userDetails.userId());
        return ResponseEntity.ok(ApiResponse.success(notifications));
    }
}
