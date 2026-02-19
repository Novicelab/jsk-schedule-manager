package com.jsk.schedule.domain.auth.repository;

import com.jsk.schedule.domain.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * 토큰 값으로 RefreshToken 조회 — 재발급/로그아웃 검증 시 사용
     */
    Optional<RefreshToken> findByToken(String token);

    /**
     * 사용자 ID로 RefreshToken 조회 — Rotation 시 기존 토큰 확인
     */
    Optional<RefreshToken> findByUserId(Long userId);

    /**
     * 사용자 ID로 RefreshToken 삭제 — 로그아웃 또는 Rotation 처리 시 사용
     */
    @Transactional
    void deleteByUserId(Long userId);
}
