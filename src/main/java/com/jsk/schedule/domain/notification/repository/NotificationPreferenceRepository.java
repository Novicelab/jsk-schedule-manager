package com.jsk.schedule.domain.notification.repository;

import com.jsk.schedule.domain.notification.entity.NotificationActionType;
import com.jsk.schedule.domain.notification.entity.NotificationPreference;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    Optional<NotificationPreference> findByUserIdAndScheduleTypeAndActionType(
            Long userId, ScheduleType scheduleType, NotificationActionType actionType);

    List<NotificationPreference> findByUserId(Long userId);
}
