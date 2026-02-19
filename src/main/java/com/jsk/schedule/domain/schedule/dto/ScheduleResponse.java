package com.jsk.schedule.domain.schedule.dto;

import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 일정 목록/상세 공통 응답 DTO.
 * - 팀 멤버: 전체 필드 반환, canEdit/canDelete 권한 판단
 * - 비소속 사용자: description null 반환, canEdit/canDelete false
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
    private Long teamId;
    private Long createdById;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean canEdit;
    private boolean canDelete;

    /**
     * 팀 멤버/Admin 응답 생성.
     * canEdit, canDelete: 본인이 등록한 일정이거나 Admin인 경우 true.
     *
     * @param schedule       일정 엔티티
     * @param currentUserId  현재 요청자 ID
     * @param isAdmin        현재 요청자가 해당 팀의 Admin인지 여부
     */
    public static ScheduleResponse from(Schedule schedule, Long currentUserId, boolean isAdmin) {
        boolean isOwner = schedule.getCreatedBy().getId().equals(currentUserId);
        boolean canEditOrDelete = isOwner || isAdmin;

        return ScheduleResponse.builder()
                .id(schedule.getId())
                .title(schedule.getTitle())
                .description(schedule.getDescription())
                .type(schedule.getType())
                .startAt(schedule.getStartAt())
                .endAt(schedule.getEndAt())
                .allDay(schedule.isAllDay())
                .teamId(schedule.getTeam().getId())
                .createdById(schedule.getCreatedBy().getId())
                .createdAt(schedule.getCreatedAt())
                .updatedAt(schedule.getUpdatedAt())
                .canEdit(canEditOrDelete)
                .canDelete(canEditOrDelete)
                .build();
    }

    /**
     * 비소속 사용자 응답 생성.
     * description은 null로 반환하여 상세 정보를 공개하지 않는다.
     * canEdit, canDelete는 항상 false.
     *
     * @param schedule 일정 엔티티
     */
    public static ScheduleResponse fromForNonMember(Schedule schedule) {
        return ScheduleResponse.builder()
                .id(schedule.getId())
                .title(schedule.getTitle())
                .description(null)
                .type(schedule.getType())
                .startAt(schedule.getStartAt())
                .endAt(schedule.getEndAt())
                .allDay(schedule.isAllDay())
                .teamId(schedule.getTeam().getId())
                .createdById(schedule.getCreatedBy().getId())
                .createdAt(schedule.getCreatedAt())
                .updatedAt(schedule.getUpdatedAt())
                .canEdit(false)
                .canDelete(false)
                .build();
    }
}
