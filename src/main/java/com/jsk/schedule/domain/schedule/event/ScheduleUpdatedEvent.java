package com.jsk.schedule.domain.schedule.event;

import com.jsk.schedule.domain.schedule.entity.Schedule;

/**
 * 일정 수정 완료 이벤트.
 * 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신하여
 * 카카오톡 알림을 비동기 발송한다.
 */
public class ScheduleUpdatedEvent {

    private final Schedule schedule;

    public ScheduleUpdatedEvent(Schedule schedule) {
        this.schedule = schedule;
    }

    public Schedule getSchedule() {
        return schedule;
    }
}
