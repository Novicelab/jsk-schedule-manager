package com.jsk.schedule.global.security;

import com.jsk.schedule.domain.user.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

/**
 * Spring Security UserDetails 구현체.
 * 카카오 OAuth 전용이므로 password는 null, authorities는 빈 리스트 반환.
 * 팀별 역할(Admin/Member) 은 서비스 레이어에서 별도 처리한다.
 */
public class CustomUserDetails implements UserDetails {

    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    /**
     * 팀별 역할은 서비스 레이어에서 직접 판단하므로 Spring Security 권한은 사용하지 않는다.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList();
    }

    /**
     * 카카오 OAuth 전용 — 비밀번호 없음.
     */
    @Override
    public String getPassword() {
        return null;
    }

    /**
     * Spring Security 컨텍스트에서 사용자 식별자를 String으로 요구하므로 userId를 변환하여 반환.
     */
    @Override
    public String getUsername() {
        return String.valueOf(user.getId());
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    /**
     * Long 타입 userId 반환 — SecurityContextHolder에서 꺼내기 편하도록 제공.
     */
    public Long userId() {
        return user.getId();
    }

    /**
     * 감싸고 있는 User 엔티티 반환.
     */
    public User getUser() {
        return user;
    }
}
