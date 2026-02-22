package com.jsk.schedule.domain.schedule.dto;

import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class ScheduleCreateRequest {

    @Size(max = 100, message = "일정 제목은 100자 이하여야 합니다.")
    private String title;

    private String description;

    @NotNull(message = "일정 유형은 필수입니다.")
    private ScheduleType type;

    @NotNull(message = "시작 일시는 필수입니다.")
    private LocalDateTime startAt;

    @NotNull(message = "종료 일시는 필수입니다.")
    private LocalDateTime endAt;

    private boolean allDay = false;

    /**
     * 종료 일시가 시작 일시보다 이후인지 검증.
     * startAt 또는 endAt이 null이면 @NotNull이 처리하므로 여기선 null-safe 처리.
     */
    @AssertTrue(message = "종료 일시는 시작 일시보다 이후여야 합니다.")
    public boolean isEndAtAfterStartAt() {
        if (startAt == null || endAt == null) {
            return true;
        }
        return endAt.isAfter(startAt);
    }

    /**
     * 업무 일정(WORK)의 경우 제목은 필수.
     * 휴가(VACATION)는 제목 선택.
     */
    @AssertTrue(message = "업무 일정의 제목은 필수입니다.")
    public boolean isTitleValidForType() {
        if (type == ScheduleType.WORK) {
            return title != null && !title.isBlank();
        }
        return true;
    }
}
