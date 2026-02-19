package com.jsk.schedule.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 카카오 OAuth 전용 사용자 엔티티.
 * BaseEntity를 상속하지 않는 이유:
 * 카카오 Access Token 갱신 시 updatedAt이 불필요하게 갱신되는 것을 방지하기 위해
 * createdAt, updatedAt을 직접 관리한다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", nullable = false, unique = true)
    private Long kakaoId;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "profile_image_url", length = 512)
    private String profileImageUrl;

    @Column(name = "kakao_access_token", length = 512)
    private String kakaoAccessToken;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * 카카오 OAuth 로그인/회원가입 시 사용자 생성
     */
    public static User of(Long kakaoId, String email, String name,
                          String profileImageUrl, String kakaoAccessToken) {
        User user = new User();
        user.kakaoId = kakaoId;
        user.email = email;
        user.name = name;
        user.profileImageUrl = profileImageUrl;
        user.kakaoAccessToken = kakaoAccessToken;
        return user;
    }

    /**
     * 사용자 이름 수정 (프로필 업데이트)
     */
    public void updateProfile(String name) {
        this.name = name;
    }

    /**
     * 카카오 Access Token 갱신 (알림톡 API 호출용)
     */
    public void updateKakaoAccessToken(String token) {
        this.kakaoAccessToken = token;
    }
}
