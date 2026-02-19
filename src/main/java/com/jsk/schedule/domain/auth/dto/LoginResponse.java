package com.jsk.schedule.domain.auth.dto;

import com.jsk.schedule.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

/**
 * 카카오 로그인/토큰 재발급 응답 DTO.
 * 설계서 4.2절 인증 API 명세 기준.
 */
@Getter
@Builder
public class LoginResponse {

    private final String accessToken;
    private final String refreshToken;
    private final String tokenType;
    private final Long expiresIn;
    private final UserInfo user;
    private final boolean isNewUser;

    /**
     * 사용자 정보 내부 DTO.
     */
    @Getter
    @Builder
    public static class UserInfo {

        private final Long id;
        private final String name;
        private final String email;
        private final String profileImageUrl;

        public static UserInfo from(User user) {
            return UserInfo.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .profileImageUrl(user.getProfileImageUrl())
                    .build();
        }
    }
}
