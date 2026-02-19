package com.jsk.schedule.domain.team.entity;

import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "teams")
public class Team extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    /**
     * 팀 생성 (최초 생성자가 Admin으로 자동 등록됨은 TeamService에서 처리)
     */
    public static Team create(String name, String description, User createdBy) {
        Team team = new Team();
        team.name = name;
        team.description = description;
        team.createdBy = createdBy;
        return team;
    }

    /**
     * 팀 정보 수정 (이름, 설명)
     */
    public void update(String name, String description) {
        this.name = name;
        this.description = description;
    }
}
