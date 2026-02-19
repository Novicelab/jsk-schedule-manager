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
import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.repository.TeamMemberRepository;
import com.jsk.schedule.domain.team.repository.TeamRepository;
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
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 일정 등록.
     * 팀 멤버(MEMBER/ADMIN)만 등록 가능.
     * 등록 완료 후 ScheduleCreatedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public ScheduleResponse createSchedule(Long userId, Long teamId, ScheduleCreateRequest request) {
        com.jsk.schedule.domain.team.entity.Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Schedule schedule = Schedule.create(
                request.getTitle(),
                request.getDescription(),
                request.getType(),
                request.getStartAt(),
                request.getEndAt(),
                request.isAllDay(),
                team,
                user
        );

        Schedule saved = scheduleRepository.save(schedule);

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신 (6단계 구현)
        eventPublisher.publishEvent(new ScheduleCreatedEvent(saved));

        log.info("일정 등록 완료 - scheduleId: {}, teamId: {}, userId: {}", saved.getId(), teamId, userId);

        return ScheduleResponse.from(saved, userId, member.isAdmin());
    }

    /**
     * 일정 목록 조회 (페이징).
     * 인증된 사용자는 누구나 조회 가능.
     * 팀 멤버이면 전체 필드, 비멤버이면 description null 반환.
     */
    @Transactional(readOnly = true)
    public ScheduleListResponse getSchedules(Long currentUserId, Long teamId,
                                              LocalDateTime startDate, LocalDateTime endDate,
                                              ScheduleType type, Pageable pageable) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        // currentUserId가 null이면 비인증 사용자이므로 팀 멤버 여부는 false로 처리
        Optional<TeamMember> memberOpt = (currentUserId != null)
                ? teamMemberRepository.findByTeamIdAndUserId(teamId, currentUserId)
                : Optional.empty();
        boolean isMember = memberOpt.isPresent();
        boolean isAdmin = isMember && memberOpt.get().isAdmin();

        Page<Schedule> schedulePage;
        if (type != null) {
            schedulePage = scheduleRepository.findByTeamIdAndTypeAndStartAtBetween(
                    teamId, type, startDate, endDate, pageable);
        } else {
            schedulePage = scheduleRepository.findByTeamIdAndStartAtBetween(
                    teamId, startDate, endDate, pageable);
        }

        Page<ScheduleResponse> responsePage = schedulePage.map(schedule -> {
            if (isMember) {
                return ScheduleResponse.from(schedule, currentUserId, isAdmin);
            } else {
                return ScheduleResponse.fromForNonMember(schedule);
            }
        });

        return ScheduleListResponse.from(responsePage);
    }

    /**
     * 일정 상세 조회.
     * 인증된 사용자는 누구나 조회 가능.
     * 팀 멤버이면 전체 필드, 비멤버이면 description null 반환.
     */
    @Transactional(readOnly = true)
    public ScheduleResponse getSchedule(Long currentUserId, Long teamId, Long scheduleId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        Schedule schedule = findScheduleInTeam(scheduleId, teamId);

        // currentUserId가 null이면 비인증 사용자이므로 팀 멤버 여부는 false로 처리
        Optional<TeamMember> memberOpt = (currentUserId != null)
                ? teamMemberRepository.findByTeamIdAndUserId(teamId, currentUserId)
                : Optional.empty();
        boolean isMember = memberOpt.isPresent();
        boolean isAdmin = isMember && memberOpt.get().isAdmin();

        if (isMember) {
            return ScheduleResponse.from(schedule, currentUserId, isAdmin);
        } else {
            return ScheduleResponse.fromForNonMember(schedule);
        }
    }

    /**
     * 일정 수정.
     * 팀 멤버만 수정 가능하며, 본인이 등록한 일정 또는 Admin만 수정 가능.
     * 수정 완료 후 ScheduleUpdatedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public ScheduleResponse updateSchedule(Long userId, Long teamId, Long scheduleId,
                                            ScheduleUpdateRequest request) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        Schedule schedule = findScheduleInTeam(scheduleId, teamId);

        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        boolean isAdmin = member.isAdmin();
        boolean isOwner = schedule.getCreatedBy().getId().equals(userId);

        if (!isOwner && !isAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        schedule.update(
                request.getTitle(),
                request.getDescription(),
                request.getStartAt(),
                request.getEndAt(),
                request.isAllDay()
        );

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신 (6단계 구현)
        eventPublisher.publishEvent(new ScheduleUpdatedEvent(schedule));

        log.info("일정 수정 완료 - scheduleId: {}, teamId: {}, userId: {}", scheduleId, teamId, userId);

        return ScheduleResponse.from(schedule, userId, isAdmin);
    }

    /**
     * 일정 삭제 (소프트 딜리트).
     * 팀 멤버만 삭제 가능하며, 본인이 등록한 일정 또는 Admin만 삭제 가능.
     * 삭제 완료 후 ScheduleDeletedEvent를 발행하여 카카오톡 알림을 비동기 처리한다.
     */
    public void deleteSchedule(Long userId, Long teamId, Long scheduleId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        Schedule schedule = findScheduleInTeam(scheduleId, teamId);

        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        boolean isAdmin = member.isAdmin();
        boolean isOwner = schedule.getCreatedBy().getId().equals(userId);

        if (!isOwner && !isAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        schedule.delete();

        // 트랜잭션 커밋 후 @TransactionalEventListener(phase = AFTER_COMMIT)로 수신 (6단계 구현)
        eventPublisher.publishEvent(new ScheduleDeletedEvent(schedule));

        log.info("일정 삭제(소프트딜리트) 완료 - scheduleId: {}, teamId: {}, userId: {}", scheduleId, teamId, userId);
    }

    /**
     * 아카이브 일정 조회 (Admin 전용).
     * 소프트 딜리트된 일정을 조회한다.
     */
    @Transactional(readOnly = true)
    public List<ScheduleResponse> getArchivedSchedules(Long userId, Long teamId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!member.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        List<Schedule> archived = scheduleRepository.findArchivedByTeamId(teamId);

        // Admin이 조회하므로 canEdit=true, canDelete=true
        return archived.stream()
                .map(schedule -> ScheduleResponse.from(schedule, userId, true))
                .collect(Collectors.toList());
    }

    /**
     * 특정 팀에 속한 일정을 조회한다.
     * 팀 소속 여부를 함께 검증하여 타 팀 일정 접근을 방지한다.
     * 소프트 딜리트된 일정 접근 시 SCHEDULE_ARCHIVED 예외를 반환하여 원인을 구분한다.
     */
    private Schedule findScheduleInTeam(Long scheduleId, Long teamId) {
        Optional<Schedule> scheduleOpt = scheduleRepository.findById(scheduleId);

        if (scheduleOpt.isEmpty()) {
            // 소프트 딜리트된 일정인지 별도 확인
            boolean isArchived = scheduleRepository
                    .findArchivedByIdAndTeamId(scheduleId, teamId)
                    .isPresent();
            if (isArchived) {
                throw new BusinessException(ErrorCode.SCHEDULE_ARCHIVED);
            }
            throw new BusinessException(ErrorCode.SCHEDULE_NOT_FOUND);
        }

        Schedule schedule = scheduleOpt.get();
        if (!schedule.getTeam().getId().equals(teamId)) {
            throw new BusinessException(ErrorCode.SCHEDULE_NOT_FOUND);
        }

        return schedule;
    }
}
