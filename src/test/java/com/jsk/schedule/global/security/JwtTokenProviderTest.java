package com.jsk.schedule.global.security;

import com.jsk.schedule.global.config.JwtConfig;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtTokenProvider 단위 테스트")
class JwtTokenProviderTest {

    @InjectMocks
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private JwtConfig jwtConfig;

    // HMAC-SHA256 최소 32자(256bit) 이상의 테스트 시크릿 키
    private static final String TEST_SECRET = "test-secret-key-must-be-at-least-32-bytes-long!!";
    private static final long ACCESS_TOKEN_EXPIRATION = 3600000L;   // 1시간
    private static final long REFRESH_TOKEN_EXPIRATION = 2592000000L; // 30일

    @BeforeEach
    void setUp() {
        given(jwtConfig.getSecret()).willReturn(TEST_SECRET);
        given(jwtConfig.getAccessTokenExpiration()).willReturn(ACCESS_TOKEN_EXPIRATION);
        given(jwtConfig.getRefreshTokenExpiration()).willReturn(REFRESH_TOKEN_EXPIRATION);

        // @PostConstruct 수동 호출 (MockitoExtension은 @PostConstruct를 자동 실행하지 않음)
        jwtTokenProvider.init();
    }

    // ========== generateAccessToken 테스트 ==========

    @Test
    @DisplayName("generateAccessToken: userId를 포함한 Access Token이 생성된다")
    void generateAccessToken_shouldReturnTokenWithUserId() {
        // Act
        String token = jwtTokenProvider.generateAccessToken(1L);

        // Assert
        assertThat(token).isNotBlank();
        assertThat(jwtTokenProvider.getUserId(token)).isEqualTo(1L);
    }

    @Test
    @DisplayName("generateRefreshToken: userId를 포함한 Refresh Token이 생성된다")
    void generateRefreshToken_shouldReturnTokenWithUserId() {
        // Act
        String token = jwtTokenProvider.generateRefreshToken(42L);

        // Assert
        assertThat(token).isNotBlank();
        assertThat(jwtTokenProvider.getUserId(token)).isEqualTo(42L);
    }

    // ========== getUserId 테스트 ==========

    @Test
    @DisplayName("getUserId: 유효한 토큰에서 userId를 올바르게 추출한다")
    void getUserId_whenValidToken_shouldReturnCorrectUserId() {
        // Arrange
        String token = jwtTokenProvider.generateAccessToken(99L);

        // Act
        Long userId = jwtTokenProvider.getUserId(token);

        // Assert
        assertThat(userId).isEqualTo(99L);
    }

    // ========== validateToken 테스트 ==========

    @Test
    @DisplayName("validateToken: 유효한 토큰 검증 시 예외가 발생하지 않는다")
    void validateToken_whenValidToken_shouldNotThrow() {
        // Arrange
        String token = jwtTokenProvider.generateAccessToken(1L);

        // Act & Assert (예외 없이 정상 종료 확인)
        jwtTokenProvider.validateToken(token);
    }

    @Test
    @DisplayName("validateToken: 위변조된 토큰 검증 시 INVALID_TOKEN 예외가 발생한다")
    void validateToken_whenTamperedToken_shouldThrowInvalidToken() {
        // Arrange
        String validToken = jwtTokenProvider.generateAccessToken(1L);
        String tamperedToken = validToken + "tampered";

        // Act & Assert
        assertThatThrownBy(() -> jwtTokenProvider.validateToken(tamperedToken))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }

    @Test
    @DisplayName("validateToken: 완전히 잘못된 형식의 토큰 검증 시 INVALID_TOKEN 예외가 발생한다")
    void validateToken_whenMalformedToken_shouldThrowInvalidToken() {
        // Act & Assert
        assertThatThrownBy(() -> jwtTokenProvider.validateToken("this.is.not.a.valid.jwt"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }

    @Test
    @DisplayName("validateToken: 만료된 토큰 검증 시 EXPIRED_TOKEN 예외가 발생한다")
    void validateToken_whenExpiredToken_shouldThrowExpiredToken() {
        // Arrange: 만료 시간을 -1ms로 설정하여 즉시 만료 토큰 생성
        given(jwtConfig.getAccessTokenExpiration()).willReturn(-1L);
        String expiredToken = jwtTokenProvider.generateAccessToken(1L);

        // Act & Assert
        assertThatThrownBy(() -> jwtTokenProvider.validateToken(expiredToken))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXPIRED_TOKEN);
    }

    // ========== getExpiration 테스트 ==========

    @Test
    @DisplayName("getExpiration: 토큰의 만료 일시가 현재 시각보다 이후이다")
    void getExpiration_shouldReturnFutureDateTime() {
        // Arrange
        String token = jwtTokenProvider.generateAccessToken(1L);

        // Act
        LocalDateTime expiration = jwtTokenProvider.getExpiration(token);

        // Assert
        assertThat(expiration).isAfter(LocalDateTime.now());
    }

    // ========== init 검증 테스트 ==========

    @Test
    @DisplayName("init: Secret 길이가 32자 미만이면 IllegalArgumentException이 발생한다")
    void init_whenSecretTooShort_shouldThrowIllegalArgumentException() {
        // Arrange
        JwtConfig shortSecretConfig = new JwtConfig();
        shortSecretConfig.setSecret("too-short");
        shortSecretConfig.setAccessTokenExpiration(ACCESS_TOKEN_EXPIRATION);
        shortSecretConfig.setRefreshTokenExpiration(REFRESH_TOKEN_EXPIRATION);

        JwtTokenProvider providerWithShortSecret = new JwtTokenProvider(shortSecretConfig);

        // Act & Assert
        assertThatThrownBy(providerWithShortSecret::init)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("최소 32자");
    }
}
