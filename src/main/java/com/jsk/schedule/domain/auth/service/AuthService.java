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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 인증 비즈니스 로직 서비스.
 * 카카오 OAuth 로그인, 토큰 재발급, 로그아웃을 담당한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final KakaoOAuthClient kakaoOAuthClient;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtConfig jwtConfig;

    /**
     * 카카오 Authorization Code로 로그인 처리.
     * 미가입 사용자는 자동으로 회원가입 처리한다.
     *
     * @param code 카카오 인증 서버로부터 받은 Authorization Code
     * @return LoginResponse (JWT 토큰 + 사용자 정보)
     */
    public LoginResponse login(String code) {
        // 1. Authorization Code → 카카오 Access Token 교환
        KakaoTokenResponse kakaoToken = kakaoOAuthClient.getKakaoToken(code);

        // 2. 카카오 Access Token → 사용자 정보 조회
        KakaoUserInfo kakaoUserInfo = kakaoOAuthClient.getKakaoUserInfo(kakaoToken.getAccessToken());

        // 3. 기존 사용자 조회 또는 신규 생성
        boolean isNewUser = !userRepository.existsByKakaoId(kakaoUserInfo.getKakaoId());
        User user = findOrCreateUser(kakaoUserInfo, kakaoToken.getAccessToken());

        // 4. Refresh Token Rotation: 기존 토큰 삭제 후 새로 발급
        refreshTokenRepository.deleteByUserId(user.getId());

        String newAccessToken = jwtTokenProvider.generateAccessToken(user.getId());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());
        LocalDateTime refreshTokenExpiresAt = jwtTokenProvider.getExpiration(newRefreshToken);

        RefreshToken refreshTokenEntity = RefreshToken.create(user, newRefreshToken, refreshTokenExpiresAt);
        refreshTokenRepository.save(refreshTokenEntity);

        log.debug("로그인 성공: userId={}, isNewUser={}", user.getId(), isNewUser);

        // 5. 응답 반환 (expiresIn: 초 단위)
        return buildLoginResponse(newAccessToken, newRefreshToken, user, isNewUser);
    }

    /**
     * Refresh Token 기반 Access Token 재발급 (Rotation 적용).
     *
     * @param refreshToken 클라이언트가 보유한 Refresh Token
     * @return LoginResponse (새 JWT 토큰 + 사용자 정보)
     */
    public LoginResponse reissue(String refreshToken) {
        // 1. DB에서 Refresh Token 조회
        RefreshToken storedToken = refreshTokenRepository.findByToken(refreshToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

        // 2. 토큰 서명/만료 검증 (EXPIRED_TOKEN or INVALID_TOKEN throw)
        jwtTokenProvider.validateToken(refreshToken);

        User user = storedToken.getUser();

        // 3. Rotation: 기존 토큰 삭제 → 새 토큰 발급
        refreshTokenRepository.deleteByUserId(user.getId());

        String newAccessToken = jwtTokenProvider.generateAccessToken(user.getId());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());
        LocalDateTime refreshTokenExpiresAt = jwtTokenProvider.getExpiration(newRefreshToken);

        RefreshToken newRefreshTokenEntity = RefreshToken.create(user, newRefreshToken, refreshTokenExpiresAt);
        refreshTokenRepository.save(newRefreshTokenEntity);

        log.debug("토큰 재발급 성공: userId={}", user.getId());

        return buildLoginResponse(newAccessToken, newRefreshToken, user, false);
    }

    /**
     * 로그아웃 처리. Refresh Token을 DB에서 삭제한다.
     * 이미 로그아웃된 상태(토큰 없음)는 조용히 무시한다.
     *
     * @param refreshToken 로그아웃할 Refresh Token
     */
    public void logout(String refreshToken) {
        refreshTokenRepository.findByToken(refreshToken)
                .ifPresentOrElse(
                        token -> {
                            refreshTokenRepository.delete(token);
                            log.debug("로그아웃 성공: userId={}", token.getUser().getId());
                        },
                        () -> log.debug("로그아웃 요청 - 이미 만료되거나 존재하지 않는 Refresh Token")
                );
    }

    /**
     * 카카오 사용자 정보로 기존 User를 조회하거나 신규 생성한다.
     */
    private User findOrCreateUser(KakaoUserInfo kakaoUserInfo, String kakaoAccessToken) {
        return userRepository.findByKakaoId(kakaoUserInfo.getKakaoId())
                .map(existingUser -> {
                    existingUser.updateKakaoAccessToken(kakaoAccessToken);
                    return existingUser;
                })
                .orElseGet(() -> {
                    User newUser = User.of(
                            kakaoUserInfo.getKakaoId(),
                            kakaoUserInfo.getEmail(),
                            kakaoUserInfo.getNickname(),
                            kakaoUserInfo.getProfileImageUrl(),
                            kakaoAccessToken
                    );
                    return userRepository.save(newUser);
                });
    }

    /**
     * LoginResponse 빌드 공통 메서드.
     * expiresIn은 Access Token 만료 시간을 초 단위로 변환하여 반환한다.
     */
    private LoginResponse buildLoginResponse(String accessToken, String refreshToken,
                                             User user, boolean isNewUser) {
        long expiresInSeconds = jwtConfig.getAccessTokenExpiration() / 1000;

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiresInSeconds)
                .user(LoginResponse.UserInfo.from(user))
                .isNewUser(isNewUser)
                .build();
    }
}
