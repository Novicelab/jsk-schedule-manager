package com.jsk.schedule.domain.user.entity;

import com.jsk.schedule.domain.user.entity.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * 사용자 엔티티.
 * ID/PW 로그인과 카카오 OAuth 로그인을 모두 지원한다.
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

    @Column(name = "username", unique = true, length = 50)
    private String username;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "kakao_id", unique = true)
    private Long kakaoId;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "profile_image_url", length = 512)
    private String profileImageUrl;

    @Column(name = "kakao_access_token", length = 512)
    private String kakaoAccessToken;

    @Column(name = "role", nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * ID/PW 로그인 시 사용자 생성
     */
    public static User ofCredential(String username, String password, String name, Role role) {
        User user = new User();
        user.username = username;
        user.password = password;
        user.name = name;
        user.role = role;
        return user;
    }

    /**
     * 카카오 OAuth 로그인/회원가입 시 사용자 생성
     */
    public static User ofKakao(Long kakaoId, String email, String name,
                               String profileImageUrl, String kakaoAccessToken) {
        User user = new User();
        user.kakaoId = kakaoId;
        user.email = email;
        user.name = name;
        user.profileImageUrl = profileImageUrl;
        user.kakaoAccessToken = kakaoAccessToken;
        user.role = Role.MEMBER;
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
