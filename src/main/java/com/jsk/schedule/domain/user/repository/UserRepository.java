package com.jsk.schedule.domain.user.repository;

import com.jsk.schedule.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByKakaoId(Long kakaoId);

    boolean existsByKakaoId(Long kakaoId);

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    /**
     * 카카오 AccessToken이 있는 모든 사용자 조회.
     * 알림톡 발송 대상자 조회용.
     */
    List<User> findAllByKakaoAccessTokenIsNotNull();
}
