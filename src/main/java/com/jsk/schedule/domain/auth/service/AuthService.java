package com.jsk.schedule.domain.auth.service;

import com.jsk.schedule.domain.auth.dto.LoginRequest;
import com.jsk.schedule.domain.auth.dto.LoginResponse;
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
}
