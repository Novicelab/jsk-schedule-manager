package com.jsk.schedule.domain.user.entity;

/**
 * 사용자 역할 (권한)
 * - ADMIN: 관리자 (시스템 전체 관리)
 * - MANAGER: 관리자 (팀 관리)
 * - MEMBER: 일반 팀원 (팀 일정 조회/생성)
 */
public enum Role {
    ADMIN("관리자"),
    MANAGER("팀 관리자"),
    MEMBER("일반 팀원");

    private final String description;

    Role(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
