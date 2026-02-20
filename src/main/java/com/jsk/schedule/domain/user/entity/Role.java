package com.jsk.schedule.domain.user.entity;

/**
 * 사용자 역할 (권한)
 * - USER: 모든 인증 사용자는 동등한 USER 역할
 */
public enum Role {
    USER("사용자");

    private final String description;

    Role(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
