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
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * POST /api/schedules
     * 일정 등록. 모든 인증 사용자 가능.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ScheduleResponse> createSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ScheduleCreateRequest request) {

        ScheduleResponse response = scheduleService.createSchedule(
                userDetails.userId(), request);

        return ApiResponse.success(response);
    }

    /**
     * GET /api/schedules/archived
     * 아카이브(소프트 딜리트) 일정 조회.
     * 주의: /{scheduleId} 보다 반드시 먼저 선언해야 'archived'가 경로 변수로 해석되지 않는다.
     */
    @GetMapping("/archived")
    public ApiResponse<List<ScheduleResponse>> getArchivedSchedules(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        List<ScheduleResponse> response = scheduleService.getArchivedSchedules(
                userDetails.userId());

        return ApiResponse.success(response);
    }

    /**
     * GET /api/schedules
     * 일정 목록 조회. 모든 인증 사용자 가능.
     */
    @GetMapping
    public ApiResponse<ScheduleListResponse> getSchedules(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) ScheduleType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        if (startDate == null || endDate == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "startDate와 endDate는 필수입니다.");
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startAt"));

        ScheduleListResponse response = scheduleService.getSchedules(
                userDetails.userId(), startDate, endDate, type, pageable);

        return ApiResponse.success(response);
    }

    /**
     * GET /api/schedules/{scheduleId}
     * 일정 상세 조회. 모든 인증 사용자 가능.
     */
    @GetMapping("/{scheduleId}")
    public ApiResponse<ScheduleResponse> getSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long scheduleId) {

        ScheduleResponse response = scheduleService.getSchedule(userDetails.userId(), scheduleId);

        return ApiResponse.success(response);
    }

    /**
     * PUT /api/schedules/{scheduleId}
     * 일정 수정. 소유자만 가능.
     */
    @PutMapping("/{scheduleId}")
    public ApiResponse<ScheduleResponse> updateSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleUpdateRequest request) {

        ScheduleResponse response = scheduleService.updateSchedule(
                userDetails.userId(), scheduleId, request);

        return ApiResponse.success(response);
    }

    /**
     * DELETE /api/schedules/{scheduleId}
     * 일정 삭제(소프트 딜리트). 소유자만 가능.
     */
    @DeleteMapping("/{scheduleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchedule(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long scheduleId) {

        scheduleService.deleteSchedule(userDetails.userId(), scheduleId);
    }
}
