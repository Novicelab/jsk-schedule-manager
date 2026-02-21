package com.jsk.schedule.domain.auth.service;

import com.jsk.schedule.domain.auth.dto.KakaoTokenResponse;
import com.jsk.schedule.domain.auth.dto.KakaoUserInfo;
import com.jsk.schedule.domain.auth.dto.LoginRequest;
import com.jsk.schedule.domain.auth.dto.LoginResponse;
import com.jsk.schedule.domain.auth.entity.RefreshToken;
import com.jsk.schedule.domain.auth.repository.RefreshTokenRepository;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import com.jsk.schedule.global.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final KakaoOAuthClient kakaoOAuthClient;
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * ID/PW 로그인
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        // 사용자 조회
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "사용자를 찾을 수 없습니다"));

        log.debug("User found: username={}, password_field_present={}, password_length={}",
                user.getUsername(), user.getPassword() != null,
                user.getPassword() != null ? user.getPassword().length() : 0);

        // 비밀번호 검증
        boolean passwordMatches = passwordEncoder.matches(request.getPassword(), user.getPassword());
        log.debug("Password check: input={}, stored_password_null={}, matches={}",
                request.getPassword(), user.getPassword() == null, passwordMatches);
        log.debug("Stored password hash (first 20 chars): {}",
                user.getPassword() != null ? user.getPassword().substring(0, Math.min(20, user.getPassword().length())) : "null");

        if (!passwordMatches) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "사용자명 또는 비밀번호가 일치하지 않습니다");
        }

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername(), user.getRole());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        log.info("사용자 로그인 성공: {}", user.getUsername());

        return new LoginResponse(
                accessToken,
                refreshToken,
                new LoginResponse.UserInfo(
                        user.getId(),
                        user.getUsername(),
                        user.getName(),
                        user.getEmail(),
                        user.getRole()
                )
        );
    }

    /**
     * 카카오 OAuth 로그인/회원가입.
     * Authorization Code → 카카오 Access Token 교환 → 사용자 정보 조회 → 사용자 저장 또는 조회 → JWT 토큰 발급
     */
    @Transactional
    public LoginResponse kakaoLogin(String authorizationCode) {
        log.info("카카오 OAuth 로그인 처리 시작");

        // Step 1: Authorization Code를 카카오 Access Token으로 교환
        KakaoTokenResponse kakaoTokenResponse = kakaoOAuthClient.getKakaoToken(authorizationCode);
        String kakaoAccessToken = kakaoTokenResponse.getAccessToken();
        log.debug("카카오 Access Token 획득: {}", kakaoAccessToken.substring(0, 10) + "...");

        // Step 2: 카카오 Access Token으로 사용자 정보 조회
        KakaoUserInfo kakaoUserInfo = kakaoOAuthClient.getKakaoUserInfo(kakaoAccessToken);
        Long kakaoId = kakaoUserInfo.getKakaoId();
        log.debug("카카오 사용자 정보 조회: kakaoId={}, email={}, name={}",
                kakaoId, kakaoUserInfo.getEmail(), kakaoUserInfo.getNickname());

        // Step 3: kakaoId로 기존 사용자 조회, 없으면 신규 사용자 생성
        User user = userRepository.findByKakaoId(kakaoId)
                .orElseGet(() -> {
                    log.info("신규 카카오 사용자 가입: kakaoId={}", kakaoId);
                    User newUser = User.ofKakao(
                            kakaoId,
                            kakaoUserInfo.getEmail(),
                            kakaoUserInfo.getNickname(),
                            kakaoUserInfo.getProfileImageUrl(),
                            kakaoAccessToken
                    );
                    return userRepository.save(newUser);
                });

        // 기존 사용자인 경우 카카오 Access Token 갱신
        if (user.getKakaoAccessToken() != null && !user.getKakaoAccessToken().equals(kakaoAccessToken)) {
            user.updateKakaoAccessToken(kakaoAccessToken);
            log.debug("카카오 Access Token 갱신: kakaoId={}", kakaoId);
        }

        // Step 4: JWT 토큰 생성
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());
        log.debug("JWT 토큰 생성: userId={}", user.getId());

        // Step 5: Refresh Token 저장 (기존 토큰이 있으면 삭제 후 신규 저장)
        refreshTokenRepository.deleteByUserId(user.getId());
        RefreshToken refreshTokenEntity = RefreshToken.of(user, refreshToken);
        refreshTokenRepository.save(refreshTokenEntity);
        log.debug("Refresh Token 저장: userId={}", user.getId());

        log.info("카카오 OAuth 로그인 성공: userId={}, kakaoId={}, isNewUser={}",
                user.getId(), kakaoId, user.getCreatedAt().equals(user.getUpdatedAt()));

        return new LoginResponse(
                accessToken,
                refreshToken,
                new LoginResponse.UserInfo(
                        user.getId(),
                        null, // 카카오 로그인은 username 없음
                        user.getName(),
                        user.getEmail(),
                        user.getRole()
                )
        );
    }
}
