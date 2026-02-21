package com.jsk.schedule.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 카카오 OAuth 콜백 요청 DTO.
 * 프론트엔드에서 카카오 인증 코드를 받아 백엔드로 전달.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class KakaoLoginRequest {

    @NotBlank(message = "카카오 인증 코드는 필수입니다")
    private String code;
}
