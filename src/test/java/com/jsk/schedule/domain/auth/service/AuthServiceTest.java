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
        existingUser = User.of(12345L, "user@test.com", "테스트유저", "http://img.url", "kakaoToken");
        ReflectionTestUtils.setField(existingUser, "id", 1L);

        kakaoTokenResponse = new KakaoTokenResponse();
        ReflectionTestUtils.setField(kakaoTokenResponse, "accessToken", "kakaoAccessToken");
        ReflectionTestUtils.setField(kakaoTokenResponse, "expiresIn", 21600);

        kakaoUserInfo = new KakaoUserInfo();
        ReflectionTestUtils.setField(kakaoUserInfo, "id", 12345L);
    }

    // ========== login 테스트 ==========

    @Test
    @DisplayName("login: 기존 사용자가 로그인하면 JWT 토큰이 발급되고 isNewUser가 false이다")
    void login_whenExistingUser_shouldReturnTokensWithIsNewUserFalse() {
        // Arrange
        given(kakaoOAuthClient.getKakaoToken("authCode")).willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken")).willReturn(kakaoUserInfo);
        given(userRepository.existsByKakaoId(12345L)).willReturn(true);
        given(userRepository.findByKakaoId(12345L)).willReturn(Optional.of(existingUser));
        given(jwtTokenProvider.generateAccessToken(1L)).willReturn("newAccessToken");
        given(jwtTokenProvider.generateRefreshToken(1L)).willReturn("newRefreshToken");
        given(jwtTokenProvider.getExpiration("newRefreshToken"))
                .willReturn(LocalDateTime.now().plusDays(30));
        given(refreshTokenRepository.save(any(RefreshToken.class))).willAnswer(inv -> inv.getArgument(0));
        given(jwtConfig.getAccessTokenExpiration()).willReturn(3600000L);

        // Act
        LoginResponse response = authService.login("authCode");

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("newAccessToken");
        assertThat(response.getRefreshToken()).isEqualTo("newRefreshToken");
        assertThat(response.isNewUser()).isFalse();
        assertThat(response.getTokenType()).isEqualTo("Bearer");
    }

    @Test
    @DisplayName("login: 신규 사용자가 로그인하면 사용자가 생성되고 isNewUser가 true이다")
    void login_whenNewUser_shouldCreateUserAndReturnIsNewUserTrue() {
        // Arrange
        given(kakaoOAuthClient.getKakaoToken("authCode")).willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken")).willReturn(kakaoUserInfo);
        given(userRepository.existsByKakaoId(12345L)).willReturn(false);
        given(userRepository.findByKakaoId(12345L)).willReturn(Optional.empty());
        given(userRepository.save(any(User.class))).willReturn(existingUser);
        given(jwtTokenProvider.generateAccessToken(1L)).willReturn("accessToken");
        given(jwtTokenProvider.generateRefreshToken(1L)).willReturn("refreshToken");
        given(jwtTokenProvider.getExpiration("refreshToken"))
                .willReturn(LocalDateTime.now().plusDays(30));
        given(refreshTokenRepository.save(any(RefreshToken.class))).willAnswer(inv -> inv.getArgument(0));
        given(jwtConfig.getAccessTokenExpiration()).willReturn(3600000L);

        // Act
        LoginResponse response = authService.login("authCode");

        // Assert
        assertThat(response.isNewUser()).isTrue();
        then(userRepository).should(times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("login: 로그인 시 기존 Refresh Token이 삭제되고 새 토큰으로 교체된다 (Rotation)")
    void login_shouldDeleteOldRefreshTokenAndSaveNew() {
        // Arrange
        given(kakaoOAuthClient.getKakaoToken("authCode")).willReturn(kakaoTokenResponse);
        given(kakaoOAuthClient.getKakaoUserInfo("kakaoAccessToken")).willReturn(kakaoUserInfo);
        given(userRepository.existsByKakaoId(12345L)).willReturn(true);
        given(userRepository.findByKakaoId(12345L)).willReturn(Optional.of(existingUser));
        given(jwtTokenProvider.generateAccessToken(1L)).willReturn("accessToken");
        given(jwtTokenProvider.generateRefreshToken(1L)).willReturn("refreshToken");
        given(jwtTokenProvider.getExpiration("refreshToken"))
                .willReturn(LocalDateTime.now().plusDays(30));
        given(refreshTokenRepository.save(any(RefreshToken.class))).willAnswer(inv -> inv.getArgument(0));
        given(jwtConfig.getAccessTokenExpiration()).willReturn(3600000L);

        // Act
        authService.login("authCode");

        // Assert
        then(refreshTokenRepository).should(times(1)).deleteByUserId(1L);
        then(refreshTokenRepository).should(times(1)).save(any(RefreshToken.class));
    }

    // ========== reissue 테스트 ==========

    @Test
    @DisplayName("reissue: 유효한 Refresh Token으로 재발급 시 새 토큰이 반환된다")
    void reissue_whenValidToken_shouldReturnNewTokens() {
        // Arrange
        RefreshToken storedToken = RefreshToken.create(existingUser, "validRefreshToken",
                LocalDateTime.now().plusDays(30));

        given(refreshTokenRepository.findByToken("validRefreshToken"))
                .willReturn(Optional.of(storedToken));
        given(jwtTokenProvider.generateAccessToken(1L)).willReturn("newAccessToken");
        given(jwtTokenProvider.generateRefreshToken(1L)).willReturn("newRefreshToken");
        given(jwtTokenProvider.getExpiration("newRefreshToken"))
                .willReturn(LocalDateTime.now().plusDays(30));
        given(refreshTokenRepository.save(any(RefreshToken.class))).willAnswer(inv -> inv.getArgument(0));
        given(jwtConfig.getAccessTokenExpiration()).willReturn(3600000L);

        // Act
        LoginResponse response = authService.reissue("validRefreshToken");

        // Assert
        assertThat(response.getAccessToken()).isEqualTo("newAccessToken");
        assertThat(response.getRefreshToken()).isEqualTo("newRefreshToken");
    }

    @Test
    @DisplayName("reissue: 존재하지 않는 Refresh Token으로 재발급 시 REFRESH_TOKEN_NOT_FOUND 예외가 발생한다")
    void reissue_whenTokenNotFound_shouldThrowRefreshTokenNotFound() {
        // Arrange
        given(refreshTokenRepository.findByToken("invalidToken")).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> authService.reissue("invalidToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.REFRESH_TOKEN_NOT_FOUND);

        then(jwtTokenProvider).should(never()).generateAccessToken(anyLong());
    }

    @Test
    @DisplayName("reissue: 만료된 Refresh Token 재발급 시 EXPIRED_TOKEN 예외가 발생한다")
    void reissue_whenExpiredToken_shouldThrowExpiredToken() {
        // Arrange
        RefreshToken storedToken = RefreshToken.create(existingUser, "expiredToken",
                LocalDateTime.now().minusDays(1));

        given(refreshTokenRepository.findByToken("expiredToken"))
                .willReturn(Optional.of(storedToken));
        given(jwtTokenProvider.validateToken("expiredToken")).willAnswer(inv -> {
            throw new BusinessException(ErrorCode.EXPIRED_TOKEN);
        });

        // Act & Assert
        assertThatThrownBy(() -> authService.reissue("expiredToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXPIRED_TOKEN);
    }

    // ========== logout 테스트 ==========

    @Test
    @DisplayName("logout: 유효한 Refresh Token으로 로그아웃 시 토큰이 삭제된다")
    void logout_whenValidToken_shouldDeleteRefreshToken() {
        // Arrange
        RefreshToken storedToken = RefreshToken.create(existingUser, "refreshToken",
                LocalDateTime.now().plusDays(30));

        given(refreshTokenRepository.findByToken("refreshToken"))
                .willReturn(Optional.of(storedToken));

        // Act
        authService.logout("refreshToken");

        // Assert
        then(refreshTokenRepository).should(times(1)).delete(storedToken);
    }

    @Test
    @DisplayName("logout: 존재하지 않는 Refresh Token으로 로그아웃 시 예외 없이 조용히 처리된다")
    void logout_whenTokenNotFound_shouldNotThrowException() {
        // Arrange
        given(refreshTokenRepository.findByToken("nonExistingToken")).willReturn(Optional.empty());

        // Act & Assert (예외 없이 정상 종료 확인)
        authService.logout("nonExistingToken");

        then(refreshTokenRepository).should(never()).delete(any(RefreshToken.class));
    }
}
