package com.jsk.schedule.domain.schedule.service;

import com.jsk.schedule.domain.schedule.dto.ScheduleCreateRequest;
import com.jsk.schedule.domain.schedule.dto.ScheduleListResponse;
import com.jsk.schedule.domain.schedule.dto.ScheduleResponse;
import com.jsk.schedule.domain.schedule.dto.ScheduleUpdateRequest;
import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import com.jsk.schedule.domain.schedule.event.ScheduleCreatedEvent;
import com.jsk.schedule.domain.schedule.event.ScheduleDeletedEvent;
import com.jsk.schedule.domain.schedule.event.ScheduleUpdatedEvent;
import com.jsk.schedule.domain.schedule.repository.ScheduleRepository;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 일정 등록.
     * 모든 인증 사용자가 등록 가능.
     * 등록 완료 후 ScheduleCreatedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public ScheduleResponse createSchedule(Long userId, ScheduleCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // VACATION 타입이면 제목을 "[이름] [부제목]" 형태로 자동 설정
        // 사용자가 부제목 입력 시: "[이름] 부제목" (예: "[홍길동] 오전 반차")
        // 부제목 없을 시: "[이름]" (예: "[홍길동]")
        String title = request.getTitle();
        if (request.getType() == ScheduleType.VACATION) {
            String subtitle = (title != null && !title.isBlank()) ? " " + title.trim() : "";
            title = "[" + user.getName() + "]" + subtitle;
        }

        Schedule schedule = Schedule.create(
                title,
                request.getDescription(),
                request.getType(),
                request.getStartAt(),
                request.getEndAt(),
                request.isAllDay(),
                user
        );

        Schedule saved = scheduleRepository.save(schedule);

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신
        eventPublisher.publishEvent(new ScheduleCreatedEvent(saved));

        log.info("일정 등록 완료 - scheduleId: {}, userId: {}", saved.getId(), userId);

        return ScheduleResponse.from(saved, userId);
    }

    /**
     * 일정 목록 조회 (페이징).
     * 모든 인증 사용자가 모든 일정을 전체 필드로 조회 가능.
     */
    @Transactional(readOnly = true)
    public ScheduleListResponse getSchedules(Long currentUserId, LocalDateTime startDate, LocalDateTime endDate,
                                              ScheduleType type, Pageable pageable) {
        Page<Schedule> schedulePage;
        if (type != null) {
            schedulePage = scheduleRepository.findByTypeAndStartAtBetween(
                    type, startDate, endDate, pageable);
        } else {
            schedulePage = scheduleRepository.findByStartAtBetween(
                    startDate, endDate, pageable);
        }

        Page<ScheduleResponse> responsePage = schedulePage.map(schedule ->
                ScheduleResponse.from(schedule, currentUserId)
        );

        return ScheduleListResponse.from(responsePage);
    }

    /**
     * 일정 상세 조회.
     * 모든 인증 사용자가 모든 일정을 전체 필드로 조회 가능.
     */
    @Transactional(readOnly = true)
    public ScheduleResponse getSchedule(Long currentUserId, Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> {
                    // 소프트 딜리트된 일정인지 확인
                    if (scheduleRepository.findArchivedById(scheduleId).isPresent()) {
                        return new BusinessException(ErrorCode.SCHEDULE_ARCHIVED);
                    }
                    return new BusinessException(ErrorCode.SCHEDULE_NOT_FOUND);
                });

        return ScheduleResponse.from(schedule, currentUserId);
    }

    /**
     * 일정 수정.
     * 본인이 등록한 일정만 수정 가능.
     * 수정 완료 후 ScheduleUpdatedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public ScheduleResponse updateSchedule(Long userId, Long scheduleId, ScheduleUpdateRequest request) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> {
                    // 소프트 딜리트된 일정인지 확인
                    if (scheduleRepository.findArchivedById(scheduleId).isPresent()) {
                        return new BusinessException(ErrorCode.SCHEDULE_ARCHIVED);
                    }
                    return new BusinessException(ErrorCode.SCHEDULE_NOT_FOUND);
                });

        boolean isOwner = schedule.getCreatedBy().getId().equals(userId);
        if (!isOwner) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        // VACATION 타입이면 제목을 "[이름] [부제목]" 형태로 처리
        String title = request.getTitle();
        if (request.getType() == ScheduleType.VACATION) {
            User user = schedule.getCreatedBy();
            String subtitle = (title != null && !title.isBlank()) ? " " + title.trim() : "";
            title = "[" + user.getName() + "]" + subtitle;
        }

        schedule.update(
                title,
                request.getDescription(),
                request.getStartAt(),
                request.getEndAt(),
                request.isAllDay()
        );

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신
        eventPublisher.publishEvent(new ScheduleUpdatedEvent(schedule));

        log.info("일정 수정 완료 - scheduleId: {}, userId: {}", scheduleId, userId);

        return ScheduleResponse.from(schedule, userId);
    }

    /**
     * 일정 삭제 (소프트 딜리트).
     * 본인이 등록한 일정만 삭제 가능.
     * 삭제 완료 후 ScheduleDeletedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public void deleteSchedule(Long userId, Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> {
                    // 소프트 딜리트된 일정인지 확인
                    if (scheduleRepository.findArchivedById(scheduleId).isPresent()) {
                        return new BusinessException(ErrorCode.SCHEDULE_ARCHIVED);
                    }
                    return new BusinessException(ErrorCode.SCHEDULE_NOT_FOUND);
                });

        boolean isOwner = schedule.getCreatedBy().getId().equals(userId);
        if (!isOwner) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        schedule.delete();

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신
        eventPublisher.publishEvent(new ScheduleDeletedEvent(schedule));

        log.info("일정 삭제(소프트딜리트) 완료 - scheduleId: {}, userId: {}", scheduleId, userId);
    }

    /**
     * 아카이브 일정 조회.
     * 소프트 딜리트된 모든 일정을 조회한다.
     */
    @Transactional(readOnly = true)
    public List<ScheduleResponse> getArchivedSchedules(Long userId) {
        List<Schedule> archived = scheduleRepository.findArchived();

        return archived.stream()
                .map(schedule -> ScheduleResponse.from(schedule, userId))
                .collect(Collectors.toList());
    }
}
