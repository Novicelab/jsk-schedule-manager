package com.jsk.schedule.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 토큰 재발급 및 로그아웃 요청 DTO.
 */
@Getter
@NoArgsConstructor
public class TokenReissueRequest {

    @NotBlank(message = "refreshToken은 필수입니다.")
    private String refreshToken;
}
