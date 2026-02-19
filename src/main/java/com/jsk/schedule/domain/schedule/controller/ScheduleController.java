package com.jsk.schedule.domain.schedule.controller;

import com.jsk.schedule.domain.schedule.dto.ScheduleCreateRequest;
import com.jsk.schedule.domain.schedule.dto.ScheduleListResponse;
import com.jsk.schedule.domain.schedule.dto.ScheduleResponse;
import com.jsk.schedule.domain.schedule.dto.ScheduleUpdateRequest;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import com.jsk.schedule.domain.schedule.service.ScheduleService;
import com.jsk.schedule.global.common.ApiResponse;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import com.jsk.schedule.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/teams/{teamId}/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * POST /api/teams/{teamId}/schedules
     * 일정 등록. 팀 멤버(MEMBER/ADMIN)만 가능.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ScheduleResponse> createSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @Valid @RequestBody ScheduleCreateRequest request) {

        ScheduleResponse response = scheduleService.createSchedule(
                userDetails.userId(), teamId, request);

        return ApiResponse.success(response);
    }

    /**
     * GET /api/teams/{teamId}/schedules/archived
     * 아카이브(소프트 딜리트) 일정 조회. Admin 전용.
     * 주의: /{scheduleId} 보다 반드시 먼저 선언해야 'archived'가 경로 변수로 해석되지 않는다.
     */
    @GetMapping("/archived")
    public ApiResponse<List<ScheduleResponse>> getArchivedSchedules(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId) {

        List<ScheduleResponse> response = scheduleService.getArchivedSchedules(
                userDetails.userId(), teamId);

        return ApiResponse.success(response);
    }

    /**
     * GET /api/teams/{teamId}/schedules
     * 일정 목록 조회. 비인증 사용자도 가능 (비소속/비인증 사용자는 description null).
     * userDetails가 null인 경우 비인증 사용자로 처리한다.
     */
    @GetMapping
    public ApiResponse<ScheduleListResponse> getSchedules(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) ScheduleType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        if (startDate == null || endDate == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "startDate와 endDate는 필수입니다.");
        }

        Long userId = (userDetails != null) ? userDetails.userId() : null;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startAt"));

        ScheduleListResponse response = scheduleService.getSchedules(
                userId, teamId, startDate, endDate, type, pageable);

        return ApiResponse.success(response);
    }

    /**
     * GET /api/teams/{teamId}/schedules/{scheduleId}
     * 일정 상세 조회. 비인증 사용자도 가능 (비소속/비인증 사용자는 description null).
     * userDetails가 null인 경우 비인증 사용자로 처리한다.
     */
    @GetMapping("/{scheduleId}")
    public ApiResponse<ScheduleResponse> getSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @PathVariable Long scheduleId) {

        Long userId = (userDetails != null) ? userDetails.userId() : null;
        ScheduleResponse response = scheduleService.getSchedule(userId, teamId, scheduleId);

        return ApiResponse.success(response);
    }

    /**
     * PUT /api/teams/{teamId}/schedules/{scheduleId}
     * 일정 수정. 본인 또는 Admin만 가능.
     */
    @PutMapping("/{scheduleId}")
    public ApiResponse<ScheduleResponse> updateSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleUpdateRequest request) {

        ScheduleResponse response = scheduleService.updateSchedule(
                userDetails.userId(), teamId, scheduleId, request);

        return ApiResponse.success(response);
    }

    /**
     * DELETE /api/teams/{teamId}/schedules/{scheduleId}
     * 일정 삭제(소프트 딜리트). 본인 또는 Admin만 가능.
     */
    @DeleteMapping("/{scheduleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @PathVariable Long scheduleId) {

        scheduleService.deleteSchedule(userDetails.userId(), teamId, scheduleId);
    }
}
