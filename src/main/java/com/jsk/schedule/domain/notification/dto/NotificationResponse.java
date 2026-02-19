package com.jsk.schedule.domain.notification.dto;

import com.jsk.schedule.domain.notification.entity.Notification;
import com.jsk.schedule.domain.notification.entity.NotificationStatus;
import com.jsk.schedule.domain.notification.entity.NotificationType;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 알림 이력 응답 DTO.
 * GET /api/notifications/me 응답에 사용.
 */
@Getter
public class NotificationResponse {

    private final Long id;
    private final Long scheduleId;
    private final NotificationType type;
    private final NotificationStatus status;
    private final String message;
    private final LocalDateTime sentAt;
    private final LocalDateTime createdAt;

    private NotificationResponse(Long id, Long scheduleId, NotificationType type,
                                  NotificationStatus status, String message,
                                  LocalDateTime sentAt, LocalDateTime createdAt) {
        this.id = id;
        this.scheduleId = scheduleId;
        this.type = type;
        this.status = status;
        this.message = message;
        this.sentAt = sentAt;
        this.createdAt = createdAt;
    }

    /**
     * Notification 엔티티를 응답 DTO로 변환한다.
     *
     * @param notification 알림 엔티티
     * @return NotificationResponse
     */
    public static NotificationResponse from(Notification notification) {
        Long scheduleId = notification.getSchedule() != null
                ? notification.getSchedule().getId()
                : null;

        return new NotificationResponse(
                notification.getId(),
                scheduleId,
                notification.getType(),
                notification.getStatus(),
                notification.getMessage(),
                notification.getSentAt(),
                notification.getCreatedAt()
        );
    }
}
