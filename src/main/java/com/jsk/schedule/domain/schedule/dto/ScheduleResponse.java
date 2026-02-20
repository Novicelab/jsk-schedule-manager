package com.jsk.schedule.domain.schedule.dto;

import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 일정 목록/상세 공통 응답 DTO.
 * 모든 인증 사용자는 모든 일정을 전체 필드로 조회 가능.
 * canEdit, canDelete: 본인이 등록한 일정인 경우만 true.
 */
@Getter
@Builder
public class ScheduleResponse {

    private Long id;
    private String title;
    private String description;
    private ScheduleType type;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private boolean allDay;
    private Long createdById;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean canEdit;
    private boolean canDelete;

    /**
     * 일정 응답 생성.
     * canEdit, canDelete: 본인이 등록한 일정인 경우만 true.
     *
     * @param schedule       일정 엔티티
     * @param currentUserId  현재 요청자 ID
     */
    public static ScheduleResponse from(Schedule schedule, Long currentUserId) {
        boolean isOwner = schedule.getCreatedBy().getId().equals(currentUserId);

        return ScheduleResponse.builder()
                .id(schedule.getId())
                .title(schedule.getTitle())
                .description(schedule.getDescription())
                .type(schedule.getType())
                .startAt(schedule.getStartAt())
                .endAt(schedule.getEndAt())
                .allDay(schedule.isAllDay())
                .createdById(schedule.getCreatedBy().getId())
                .createdAt(schedule.getCreatedAt())
                .updatedAt(schedule.getUpdatedAt())
                .canEdit(isOwner)
                .canDelete(isOwner)
                .build();
    }
}
