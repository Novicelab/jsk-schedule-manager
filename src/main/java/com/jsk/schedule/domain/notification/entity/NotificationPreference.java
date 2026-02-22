package com.jsk.schedule.domain.notification.entity;

import com.jsk.schedule.domain.schedule.entity.ScheduleType;
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
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * 사용자별 알림 수신 설정 엔티티.
 * 일정 유형(VACATION/WORK) × 액션 유형(CREATED/UPDATED/DELETED) 조합으로 6개 레코드가 생성된다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "notification_preferences")
public class NotificationPreference extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 10)
    private ScheduleType scheduleType;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 10)
    private NotificationActionType actionType;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Builder
    public NotificationPreference(User user, ScheduleType scheduleType,
                                  NotificationActionType actionType, boolean enabled) {
        this.user = user;
        this.scheduleType = scheduleType;
        this.actionType = actionType;
        this.enabled = enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
