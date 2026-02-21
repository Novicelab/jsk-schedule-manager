package com.jsk.schedule.domain.schedule.entity;

import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

/**
 * 일정 엔티티.
 * @SQLRestriction으로 deleted_at IS NULL 조건을 자동 적용 (Hibernate 6+ 방식).
 * 소프트 딜리트 정책: 물리 삭제 금지, delete() 메서드로만 deletedAt 설정.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "schedules")
@SQLRestriction("deleted_at IS NULL")
public class Schedule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 10)
    private ScheduleType type;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "all_day", nullable = false)
    private boolean allDay = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User createdBy;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public static Schedule create(String title, String description, ScheduleType type,
                                  LocalDateTime startAt, LocalDateTime endAt, boolean allDay,
                                  User createdBy) {
        Schedule schedule = new Schedule();
        schedule.title = title;
        schedule.description = description;
        schedule.type = type;
        schedule.startAt = startAt;
        schedule.endAt = endAt;
        schedule.allDay = allDay;
        schedule.createdBy = createdBy;
        return schedule;
    }

    /**
     * 일정 수정 — 제목, 설명, 일시, 종일 여부만 변경 가능 (type은 변경 불가)
     */
    public void update(String title, String description,
                       LocalDateTime startAt, LocalDateTime endAt, boolean allDay) {
        this.title = title;
        this.description = description;
        this.startAt = startAt;
        this.endAt = endAt;
        this.allDay = allDay;
    }

    /**
     * 소프트 딜리트 — deletedAt 설정 (물리 삭제 금지)
     */
    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return this.deletedAt != null;
    }
}
