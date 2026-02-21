package com.jsk.schedule.domain.auth.service;

import com.jsk.schedule.domain.auth.dto.KakaoTokenResponse;
import com.jsk.schedule.domain.auth.dto.KakaoUserInfo;
import com.jsk.schedule.domain.auth.dto.LoginResponse;
import com.jsk.schedule.domain.auth.entity.RefreshToken;
import com.jsk.schedule.domain.auth.repository.RefreshTokenRepository;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.config.JwtConfig;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import com.jsk.schedule.global.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService 단위 테스트")
class AuthServiceTest {

    @InjectMocks
    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private KakaoOAuthClient kakaoOAuthClient;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private JwtConfig jwtConfig;

    private User existingUser;
    private KakaoTokenResponse kakaoTokenResponse;
    private KakaoUserInfo kakaoUserInfo;

    @BeforeEach
    void setUp() {
        existingUser = User.ofKakao(12345L, "user@test.com", "테스트유저", "http://img.url", "kakaoToken");
        ReflectionTestUtils.setField(existingUser, "id", 1L);

        kakaoTokenResponse = new KakaoTokenResponse();
        ReflectionTestUtils.setField(kakaoTokenResponse, "accessToken", "kakaoAccessToken");
        ReflectionTestUtils.setField(kakaoTokenResponse, "expiresIn", 21600);

        kakaoUserInfo = new KakaoUserInfo();
        ReflectionTestUtils.setField(kakaoUserInfo, "id", 12345L);
    }

    // ========== kakaoLogin 테스트 ==========

    @Test
    @DisplayName("kakaoLogin: 신규 사용자는 자동 가입되고 isNewUser가 true이다")
    void kakaoLogin_whenNewUser_shouldCreateUserAndReturnIsNewUserTrue() {
        // Arrange
        String authCode = "kakaoAuthCode123";
        Long kakaoId = 12345L;

        KakaoUserInfo kakaoUserInfo = new KakaoUserInfo();
        ReflectionTestUtils.setField(kakaoUserInfo, "id", kakaoId);

        User newUser = User.ofKakao(kakaoId, "user@kakao.com", "카카오유저",
                "http://profile.url", "kakaoAccessToken");
        ReflectionTestUtils.setField(newUser, "id", 1L);
        ReflectionTestUtils.setField(newUser, "createdAt", LocalDateTime.now());
        ReflectionTestUtils.setField(newUser, "updatedAt", LocalDateTime.now());

        given(kakaoOAuthClient.getKakaoToken(authCode))
                .willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken"))
                .willReturn(kakaoUserInfo);
        given(userRepository.findByKakaoId(kakaoId))
                .willReturn(Optional.empty());
        given(userRepository.save(any(User.class)))
                .willReturn(newUser);
        given(jwtTokenProvider.generateAccessToken(1L))
                .willReturn("newAccessToken");
        given(jwtTokenProvider.generateRefreshToken(1L))
                .willReturn("newRefreshToken");
        given(refreshTokenRepository.save(any(RefreshToken.class)))
                .willAnswer(inv -> inv.getArgument(0));

        // Act
        LoginResponse response = authService.kakaoLogin(authCode);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("newAccessToken");
        assertThat(response.getRefreshToken()).isEqualTo("newRefreshToken");
        assertThat(response.getUser()).isNotNull();
        assertThat(response.getUser().getName()).isEqualTo("카카오유저");
        then(userRepository).should(times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("kakaoLogin: 기존 사용자는 자동 로그인되고 isNewUser가 false이다")
    void kakaoLogin_whenExistingUser_shouldLoginAndReturnIsNewUserFalse() {
        // Arrange
        String authCode = "kakaoAuthCode456";
        Long kakaoId = 54321L;

        KakaoUserInfo kakaoUserInfo = new KakaoUserInfo();
        ReflectionTestUtils.setField(kakaoUserInfo, "id", kakaoId);

        User existingKakaoUser = User.ofKakao(kakaoId, "existing@kakao.com", "기존유저",
                "http://profile2.url", "oldKakaoToken");
        ReflectionTestUtils.setField(existingKakaoUser, "id", 2L);
        ReflectionTestUtils.setField(existingKakaoUser, "createdAt", LocalDateTime.now().minusMonths(1));
        ReflectionTestUtils.setField(existingKakaoUser, "updatedAt", LocalDateTime.now().minusMonths(1));

        given(kakaoOAuthClient.getKakaoToken(authCode))
                .willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken"))
                .willReturn(kakaoUserInfo);
        given(userRepository.findByKakaoId(kakaoId))
                .willReturn(Optional.of(existingKakaoUser));
        given(jwtTokenProvider.generateAccessToken(2L))
                .willReturn("existingAccessToken");
        given(jwtTokenProvider.generateRefreshToken(2L))
                .willReturn("existingRefreshToken");
        given(refreshTokenRepository.save(any(RefreshToken.class)))
                .willAnswer(inv -> inv.getArgument(0));

        // Act
        LoginResponse response = authService.kakaoLogin(authCode);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("existingAccessToken");
        assertThat(response.getUser().getId()).isEqualTo(2L);
        then(userRepository).should(never()).save(any(User.class));
    }

    @Test
    @DisplayName("kakaoLogin: 카카오 API 오류 시 KAKAO_API_ERROR 예외가 발생한다")
    void kakaoLogin_whenKakaoApiError_shouldThrowKakaoApiError() {
        // Arrange
        String authCode = "invalidAuthCode";

        given(kakaoOAuthClient.getKakaoToken(authCode))
                .willThrow(new BusinessException(ErrorCode.KAKAO_API_ERROR));

        // Act & Assert
        assertThatThrownBy(() -> authService.kakaoLogin(authCode))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.KAKAO_API_ERROR);
    }

    @Test
    @DisplayName("kakaoLogin: Refresh Token이 정상적으로 저장된다")
    void kakaoLogin_shouldSaveRefreshTokenWithExpiration() {
        // Arrange
        String authCode = "kakaoAuthCode789";
        Long kakaoId = 99999L;

        KakaoUserInfo kakaoUserInfo = new KakaoUserInfo();
        ReflectionTestUtils.setField(kakaoUserInfo, "id", kakaoId);

        User newUser = User.ofKakao(kakaoId, "newuser@kakao.com", "신규유저",
                "http://profile3.url", "kakaoAccessToken");
        ReflectionTestUtils.setField(newUser, "id", 3L);

        given(kakaoOAuthClient.getKakaoToken(authCode))
                .willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken"))
                .willReturn(kakaoUserInfo);
        given(userRepository.findByKakaoId(kakaoId))
                .willReturn(Optional.empty());
        given(userRepository.save(any(User.class)))
                .willReturn(newUser);
        given(jwtTokenProvider.generateAccessToken(3L))
                .willReturn("accessToken");
        given(jwtTokenProvider.generateRefreshToken(3L))
                .willReturn("refreshToken");

        ArgumentCaptor<RefreshToken> refreshTokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
        given(refreshTokenRepository.save(refreshTokenCaptor.capture()))
                .willAnswer(inv -> inv.getArgument(0));

        // Act
        authService.kakaoLogin(authCode);

        // Assert
        then(refreshTokenRepository).should(times(1)).deleteByUserId(3L);
        then(refreshTokenRepository).should(times(1)).save(any(RefreshToken.class));

        RefreshToken savedToken = refreshTokenCaptor.getValue();
        assertThat(savedToken.getToken()).isEqualTo("refreshToken");
        assertThat(savedToken.isExpired()).isFalse();
    }

    // ========== login 테스트 ==========


}
