package com.jsk.schedule.domain.schedule.event;

import com.jsk.schedule.domain.schedule.entity.Schedule;

/**
 * 일정 삭제(소프트 딜리트) 완료 이벤트.
 * 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신하여
 * 카카오톡 알림을 비동기 발송한다.
 */
public class ScheduleDeletedEvent {

    private final Schedule schedule;

    public ScheduleDeletedEvent(Schedule schedule) {
        this.schedule = schedule;
    }

    public Schedule getSchedule() {
        return schedule;
    }
}
