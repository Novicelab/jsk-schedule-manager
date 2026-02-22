package com.jsk.schedule.domain.user.controller;

import com.jsk.schedule.domain.notification.dto.NotificationPreferenceResponse;
import com.jsk.schedule.domain.notification.dto.NotificationPreferenceUpdateRequest;
import com.jsk.schedule.domain.notification.service.NotificationPreferenceService;
import com.jsk.schedule.domain.user.dto.UserProfileResponse;
import com.jsk.schedule.domain.user.dto.UserProfileUpdateRequest;
import com.jsk.schedule.domain.user.service.UserService;
import com.jsk.schedule.global.common.ApiResponse;
import com.jsk.schedule.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final NotificationPreferenceService notificationPreferenceService;

    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        UserProfileResponse response = userService.getMyProfile(userDetails.userId());
        return ApiResponse.success(response);
    }

    @PutMapping("/me")
    public ApiResponse<UserProfileResponse> updateMyProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody UserProfileUpdateRequest request) {
        UserProfileResponse response = userService.updateMyProfile(userDetails.userId(), request);
        return ApiResponse.success(response);
    }

    /**
     * 로그인 사용자의 전체 알림 수신 설정 목록을 조회한다.
     * 설정이 없는 신규 사용자는 기본값(모두 true)으로 초기화 후 반환한다.
     */
    @GetMapping("/me/notification-preferences")
    public ApiResponse<List<NotificationPreferenceResponse>> getNotificationPreferences(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<NotificationPreferenceResponse> response =
                notificationPreferenceService.getPreferences(userDetails.userId());
        return ApiResponse.success(response);
    }

    /**
     * 특정 알림 설정의 활성화 여부를 업데이트한다.
     *
     * @param key key 형식: "VACATION_CREATED", "WORK_DELETED" 등
     */
    @PutMapping("/me/notification-preferences/{key}")
    public ApiResponse<NotificationPreferenceResponse> updateNotificationPreference(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable String key,
            @Valid @RequestBody NotificationPreferenceUpdateRequest request) {
        NotificationPreferenceResponse response =
                notificationPreferenceService.updatePreference(
                        userDetails.userId(), key, request.getEnabled());
        return ApiResponse.success(response);
    }
}
