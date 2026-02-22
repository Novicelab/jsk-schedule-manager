package com.jsk.schedule.domain.notification.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class NotificationPreferenceUpdateRequest {

    @NotNull(message = "enabled 값은 필수입니다")
    private Boolean enabled;
}
