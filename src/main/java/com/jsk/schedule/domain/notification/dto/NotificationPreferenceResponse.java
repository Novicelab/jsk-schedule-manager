package com.jsk.schedule.domain.notification.dto;

import com.jsk.schedule.domain.notification.entity.NotificationActionType;
import com.jsk.schedule.domain.notification.entity.NotificationPreference;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationPreferenceResponse {

    private String key;
    private String label;
    private boolean enabled;

    public static NotificationPreferenceResponse from(NotificationPreference pref) {
        String key = pref.getScheduleType().name() + "_" + pref.getActionType().name();
        String label = buildLabel(pref.getScheduleType(), pref.getActionType());
        return NotificationPreferenceResponse.builder()
                .key(key)
                .label(label)
                .enabled(pref.isEnabled())
                .build();
    }

    private static String buildLabel(ScheduleType scheduleType, NotificationActionType actionType) {
        String typeLabel = switch (scheduleType) {
            case VACATION -> "휴가";
            case WORK -> "업무";
        };
        String actionLabel = switch (actionType) {
            case CREATED -> "등록";
            case UPDATED -> "수정";
            case DELETED -> "삭제";
        };
        return typeLabel + " " + actionLabel + " 시";
    }
}
