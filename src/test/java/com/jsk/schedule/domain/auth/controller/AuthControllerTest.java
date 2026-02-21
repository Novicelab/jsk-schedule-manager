package com.jsk.schedule.domain.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jsk.schedule.domain.auth.dto.KakaoLoginRequest;
import com.jsk.schedule.domain.auth.dto.LoginResponse;
import com.jsk.schedule.domain.auth.service.AuthService;
import com.jsk.schedule.domain.user.entity.Role;
import com.jsk.schedule.global.config.JwtConfig;
import com.jsk.schedule.global.config.SecurityConfig;
import com.jsk.schedule.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@DisplayName("AuthController 통합 테스트")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtConfig jwtConfig;

    private LoginResponse loginResponse;

    @BeforeEach
    void setUp() {
        loginResponse = new LoginResponse(
                "testAccessToken",
                "testRefreshToken",
                new LoginResponse.UserInfo(
                        1L,
                        null, // 카카오 로그인은 username 없음
                        "테스트유저",
                        "test@kakao.com",
                        Role.USER
                )
        );
    }

    // ========== 카카오 콜백 엔드포인트 테스트 ==========

    @Test
    @DisplayName("kakaoCallback: 유효한 Authorization Code로 요청하면 200 Success와 토큰을 반환한다")
    void kakaoCallback_withValidCode_shouldReturn200AndTokens() throws Exception {
        // Arrange
        KakaoLoginRequest request = new KakaoLoginRequest("validAuthCode");
        given(authService.kakaoLogin("validAuthCode"))
                .willReturn(loginResponse);

        // Act & Assert
        mockMvc.perform(post("/api/auth/kakao/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.accessToken").value("testAccessToken"))
                .andExpect(jsonPath("$.data.refreshToken").value("testRefreshToken"))
                .andExpect(jsonPath("$.data.user.id").value(1))
                .andExpect(jsonPath("$.data.user.name").value("테스트유저"))
                .andExpect(jsonPath("$.data.user.email").value("test@kakao.com"));
    }

    @Test
    @DisplayName("kakaoCallback: 빈 Authorization Code로 요청하면 400 Bad Request를 반환한다")
    void kakaoCallback_withEmptyCode_shouldReturn400BadRequest() throws Exception {
        // Arrange
        KakaoLoginRequest request = new KakaoLoginRequest("");

        // Act & Assert
        mockMvc.perform(post("/api/auth/kakao/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("kakaoCallback: Authorization Code 없이 요청하면 400 Bad Request를 반환한다")
    void kakaoCallback_withoutCode_shouldReturn400BadRequest() throws Exception {
        // Arrange
        String invalidRequest = "{}";

        // Act & Assert
        mockMvc.perform(post("/api/auth/kakao/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidRequest))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("kakaoCallback: 유효하지 않은 Authorization Code로 요청하면 500 Internal Server Error를 반환한다")
    void kakaoCallback_withInvalidCode_shouldReturn500() throws Exception {
        // Arrange
        KakaoLoginRequest request = new KakaoLoginRequest("invalidAuthCode");
        given(authService.kakaoLogin("invalidAuthCode"))
                .willThrow(new RuntimeException("카카오 API 오류"));

        // Act & Assert
        mockMvc.perform(post("/api/auth/kakao/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("kakaoCallback: 응답 포맷이 올바른 ApiResponse 형식이다")
    void kakaoCallback_shouldReturnCorrectApiResponseFormat() throws Exception {
        // Arrange
        KakaoLoginRequest request = new KakaoLoginRequest("authCode123");
        given(authService.kakaoLogin("authCode123"))
                .willReturn(loginResponse);

        // Act & Assert
        mockMvc.perform(post("/api/auth/kakao/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.message").doesNotExist());
    }
}
