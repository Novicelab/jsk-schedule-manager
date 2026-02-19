package com.jsk.schedule.domain.notification.listener;

import com.jsk.schedule.domain.notification.entity.NotificationType;
import com.jsk.schedule.domain.notification.service.NotificationService;
import com.jsk.schedule.domain.schedule.event.ScheduleCreatedEvent;
import com.jsk.schedule.domain.schedule.event.ScheduleDeletedEvent;
import com.jsk.schedule.domain.schedule.event.ScheduleUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 일정 이벤트 리스너.
 *
 * @TransactionalEventListener(phase = AFTER_COMMIT): 트랜잭션 커밋이 완료된 후에만 이벤트를 처리한다.
 * 덕분에 일정 저장이 롤백된 경우 알림이 발송되지 않는다.
 *
 * @Async("asyncExecutor"): AsyncConfig에 정의된 스레드풀에서 별도 스레드로 실행된다.
 * 알림 발송 실패는 일정 CRUD 트랜잭션에 영향을 주지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    /**
     * 일정 생성 완료 이벤트 처리.
     * 트랜잭션 커밋 후 비동기로 팀원 전체에게 알림을 발송한다.
     */
    @Async("asyncExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleScheduleCreated(ScheduleCreatedEvent event) {
        log.debug("일정 생성 이벤트 수신: scheduleId={}", event.getSchedule().getId());
        try {
            notificationService.sendScheduleNotification(
                    event.getSchedule(), NotificationType.SCHEDULE_CREATED);
        } catch (Exception e) {
            log.error("일정 생성 알림 처리 중 오류: scheduleId={}", event.getSchedule().getId(), e);
        }
    }

    /**
     * 일정 수정 완료 이벤트 처리.
     * 트랜잭션 커밋 후 비동기로 팀원 전체에게 알림을 발송한다.
     */
    @Async("asyncExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleScheduleUpdated(ScheduleUpdatedEvent event) {
        log.debug("일정 수정 이벤트 수신: scheduleId={}", event.getSchedule().getId());
        try {
            notificationService.sendScheduleNotification(
                    event.getSchedule(), NotificationType.SCHEDULE_UPDATED);
        } catch (Exception e) {
            log.error("일정 수정 알림 처리 중 오류: scheduleId={}", event.getSchedule().getId(), e);
        }
    }

    /**
     * 일정 삭제(소프트 딜리트) 완료 이벤트 처리.
     * 트랜잭션 커밋 후 비동기로 팀원 전체에게 알림을 발송한다.
     */
    @Async("asyncExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleScheduleDeleted(ScheduleDeletedEvent event) {
        log.debug("일정 삭제 이벤트 수신: scheduleId={}", event.getSchedule().getId());
        try {
            notificationService.sendScheduleNotification(
                    event.getSchedule(), NotificationType.SCHEDULE_DELETED);
        } catch (Exception e) {
            log.error("일정 삭제 알림 처리 중 오류: scheduleId={}", event.getSchedule().getId(), e);
        }
    }
}
