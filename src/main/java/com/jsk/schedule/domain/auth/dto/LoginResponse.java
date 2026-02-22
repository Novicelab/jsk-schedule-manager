package com.jsk.schedule.domain.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.jsk.schedule.domain.user.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    private UserInfo user;

    @JsonProperty("isNewUser")
    private boolean isNewUser;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long id;
        private String username;
        private String name;
        private String email;
        private Role role;
    }
}
