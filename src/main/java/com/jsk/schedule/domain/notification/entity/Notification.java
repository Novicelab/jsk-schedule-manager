package com.jsk.schedule.domain.notification.entity;

import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.user.entity.User;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * 알림 이력 엔티티.
 * BaseEntity를 상속하지 않음 — createdAt/sentAt 직접 관리 (updatedAt 불필요).
 * schedule은 nullable — 팀 초대/추방 알림은 일정과 무관하게 발송됨.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 10)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private NotificationStatus status;

    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = NotificationStatus.PENDING;
        }
        if (this.channel == null) {
            this.channel = NotificationChannel.KAKAO;
        }
    }

    /**
     * 알림 생성 — 채널은 KAKAO 기본값, 상태는 PENDING 기본값
     */
    public static Notification create(Schedule schedule, User user,
                                      NotificationType type, String message) {
        Notification notification = new Notification();
        notification.schedule = schedule;
        notification.user = user;
        notification.type = type;
        notification.message = message;
        notification.channel = NotificationChannel.KAKAO;
        notification.status = NotificationStatus.PENDING;
        return notification;
    }

    /**
     * 발송 성공 처리 — 상태 SUCCESS, sentAt 기록
     */
    public void markSuccess() {
        this.status = NotificationStatus.SUCCESS;
        this.sentAt = LocalDateTime.now();
    }

    /**
     * 발송 실패 처리 — 상태 FAILED (최대 3회 재시도 후 호출)
     */
    public void markFailed() {
        this.status = NotificationStatus.FAILED;
    }
}
