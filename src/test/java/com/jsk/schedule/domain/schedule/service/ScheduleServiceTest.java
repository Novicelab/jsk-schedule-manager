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
import com.jsk.schedule.domain.team.entity.Team;
import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.entity.TeamRole;
import com.jsk.schedule.domain.team.repository.TeamMemberRepository;
import com.jsk.schedule.domain.team.repository.TeamRepository;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
@DisplayName("ScheduleService 단위 테스트")
class ScheduleServiceTest {

    @InjectMocks
    private ScheduleService scheduleService;

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private User adminUser;
    private User memberUser;
    private User outsiderUser;
    private Team team;
    private TeamMember adminMember;
    private TeamMember regularMember;
    private Schedule schedule;

    @BeforeEach
    void setUp() {
        // Arrange: 공통 테스트 데이터 초기화
        adminUser = User.of(1001L, "admin@test.com", "Admin", null, "adminToken");
        ReflectionTestUtils.setField(adminUser, "id", 1L);

        memberUser = User.of(1002L, "member@test.com", "Member", null, "memberToken");
        ReflectionTestUtils.setField(memberUser, "id", 2L);

        outsiderUser = User.of(1003L, "outsider@test.com", "Outsider", null, "outsiderToken");
        ReflectionTestUtils.setField(outsiderUser, "id", 3L);

        team = Team.create("테스트팀", "팀 설명", adminUser);
        ReflectionTestUtils.setField(team, "id", 10L);

        adminMember = TeamMember.of(team, adminUser, TeamRole.ADMIN);
        ReflectionTestUtils.setField(adminMember, "id", 100L);

        regularMember = TeamMember.of(team, memberUser, TeamRole.MEMBER);
        ReflectionTestUtils.setField(regularMember, "id", 101L);

        schedule = Schedule.create(
                "테스트 일정",
                "일정 설명",
                ScheduleType.TEAM,
                LocalDateTime.of(2026, 3, 1, 10, 0),
                LocalDateTime.of(2026, 3, 1, 12, 0),
                false,
                team,
                memberUser
        );
        ReflectionTestUtils.setField(schedule, "id", 200L);
    }

    // ========== createSchedule 테스트 ==========

    @Test
    @DisplayName("createSchedule: 팀 멤버가 일정을 생성하면 저장 후 이벤트가 발행된다")
    void createSchedule_whenTeamMember_shouldSaveAndPublishEvent() {
        // Arrange
        ScheduleCreateRequest request = new ScheduleCreateRequest();
        ReflectionTestUtils.setField(request, "title", "신규 일정");
        ReflectionTestUtils.setField(request, "description", "설명");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 1, 9, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 1, 10, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));
        given(userRepository.findById(2L)).willReturn(Optional.of(memberUser));
        given(scheduleRepository.save(any(Schedule.class))).willReturn(schedule);

        // Act
        ScheduleResponse response = scheduleService.createSchedule(2L, 10L, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("테스트 일정");

        then(scheduleRepository).should(times(1)).save(any(Schedule.class));
        ArgumentCaptor<ScheduleCreatedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleCreatedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("createSchedule: 팀 비멤버가 일정 생성 시 FORBIDDEN 예외가 발생한다")
    void createSchedule_whenNotTeamMember_shouldThrowForbidden() {
        // Arrange
        ScheduleCreateRequest request = new ScheduleCreateRequest();
        ReflectionTestUtils.setField(request, "title", "신규 일정");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 1, 9, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 1, 10, 0));

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 3L)).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.createSchedule(3L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(scheduleRepository).should(never()).save(any());
        then(eventPublisher).should(never()).publishEvent(any());
    }

    @Test
    @DisplayName("createSchedule: 존재하지 않는 팀 ID로 요청 시 TEAM_NOT_FOUND 예외가 발생한다")
    void createSchedule_whenTeamNotFound_shouldThrowTeamNotFoundException() {
        // Arrange
        ScheduleCreateRequest request = new ScheduleCreateRequest();
        ReflectionTestUtils.setField(request, "title", "신규 일정");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 1, 9, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 1, 10, 0));

        given(teamRepository.findById(99L)).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.createSchedule(2L, 99L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TEAM_NOT_FOUND);
    }

    // ========== getSchedules 테스트 ==========

    @Test
    @DisplayName("getSchedules: 팀 멤버 조회 시 description이 포함된 일정 목록을 반환한다")
    void getSchedules_whenMember_shouldReturnSchedulesWithDescription() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        LocalDateTime start = LocalDateTime.of(2026, 3, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 3, 31, 23, 59);
        Page<Schedule> schedulePage = new PageImpl<>(List.of(schedule));

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));
        given(scheduleRepository.findByTeamIdAndStartAtBetween(10L, start, end, pageable))
                .willReturn(schedulePage);

        // Act
        ScheduleListResponse response = scheduleService.getSchedules(2L, 10L, start, end, null, pageable);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getDescription()).isEqualTo("일정 설명");
    }

    @Test
    @DisplayName("getSchedules: 비멤버 조회 시 description이 null인 일정 목록을 반환한다")
    void getSchedules_whenNonMember_shouldReturnSchedulesWithNullDescription() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        LocalDateTime start = LocalDateTime.of(2026, 3, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 3, 31, 23, 59);
        Page<Schedule> schedulePage = new PageImpl<>(List.of(schedule));

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 3L)).willReturn(Optional.empty());
        given(scheduleRepository.findByTeamIdAndStartAtBetween(10L, start, end, pageable))
                .willReturn(schedulePage);

        // Act
        ScheduleListResponse response = scheduleService.getSchedules(3L, 10L, start, end, null, pageable);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getDescription()).isNull();
    }

    // ========== getSchedule 테스트 ==========

    @Test
    @DisplayName("getSchedule: 소프트 딜리트된 일정 조회 시 SCHEDULE_ARCHIVED 예외가 발생한다")
    void getSchedule_whenDeletedSchedule_shouldThrowScheduleNotFoundException() {
        // Arrange
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.empty());
        given(scheduleRepository.findArchivedByIdAndTeamId(200L, 10L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getSchedule(2L, 10L, 200L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_ARCHIVED);
    }

    @Test
    @DisplayName("getSchedule: 다른 팀 일정 조회 시 SCHEDULE_NOT_FOUND 예외가 발생한다")
    void getSchedule_whenScheduleBelongsToOtherTeam_shouldThrowScheduleNotFoundException() {
        // Arrange
        Team otherTeam = Team.create("다른팀", "설명", adminUser);
        ReflectionTestUtils.setField(otherTeam, "id", 20L);

        Schedule otherSchedule = Schedule.create(
                "다른팀 일정", "설명", ScheduleType.TEAM,
                LocalDateTime.now(), LocalDateTime.now().plusHours(1),
                false, otherTeam, adminUser
        );
        ReflectionTestUtils.setField(otherSchedule, "id", 300L);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        // scheduleId=300이 DB에는 존재하지만 team.id=20 소속
        given(scheduleRepository.findById(300L)).willReturn(Optional.of(otherSchedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getSchedule(2L, 10L, 300L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_NOT_FOUND);
    }

    // ========== updateSchedule 테스트 ==========

    @Test
    @DisplayName("updateSchedule: 일정 소유자가 수정하면 업데이트 후 이벤트가 발행된다")
    void updateSchedule_whenOwner_shouldUpdateAndPublishEvent() {
        // Arrange
        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "수정된 제목");
        ReflectionTestUtils.setField(request, "description", "수정된 설명");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));

        // Act
        ScheduleResponse response = scheduleService.updateSchedule(2L, 10L, 200L, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("수정된 제목");

        ArgumentCaptor<ScheduleUpdatedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleUpdatedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("updateSchedule: Admin은 타인의 일정도 수정할 수 있다")
    void updateSchedule_whenAdmin_shouldUpdateOtherMemberSchedule() {
        // Arrange
        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "Admin 수정");
        ReflectionTestUtils.setField(request, "description", "설명");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        // adminUser(id=1)가 memberUser(id=2)의 일정(schedule) 수정
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));

        // Act
        ScheduleResponse response = scheduleService.updateSchedule(1L, 10L, 200L, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("Admin 수정");
        then(eventPublisher).should(times(1)).publishEvent(any(ScheduleUpdatedEvent.class));
    }

    @Test
    @DisplayName("updateSchedule: 소유자도 Admin도 아닌 일반 멤버가 타인 일정 수정 시 FORBIDDEN 예외가 발생한다")
    void updateSchedule_whenNonOwnerMember_shouldThrowForbidden() {
        // Arrange
        // outsiderAsMember: 팀 멤버이지만 일정 소유자가 아님
        User anotherMemberUser = User.of(1004L, "another@test.com", "Another", null, null);
        ReflectionTestUtils.setField(anotherMemberUser, "id", 4L);
        TeamMember anotherMember = TeamMember.of(team, anotherMemberUser, TeamRole.MEMBER);
        ReflectionTestUtils.setField(anotherMember, "id", 102L);

        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "무단 수정");
        ReflectionTestUtils.setField(request, "description", "");
        ReflectionTestUtils.setField(request, "type", ScheduleType.TEAM);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        // schedule의 createdBy는 memberUser(id=2), 요청자는 anotherMemberUser(id=4)
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 4L)).willReturn(Optional.of(anotherMember));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.updateSchedule(4L, 10L, 200L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(eventPublisher).should(never()).publishEvent(any());
    }

    // ========== deleteSchedule 테스트 ==========

    @Test
    @DisplayName("deleteSchedule: 소유자가 삭제 요청 시 소프트 딜리트 후 이벤트가 발행된다")
    void deleteSchedule_whenOwner_shouldSoftDeleteAndPublishEvent() {
        // Arrange
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));

        // Act
        scheduleService.deleteSchedule(2L, 10L, 200L);

        // Assert
        assertThat(schedule.isDeleted()).isTrue();
        assertThat(schedule.getDeletedAt()).isNotNull();

        ArgumentCaptor<ScheduleDeletedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleDeletedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("deleteSchedule: Admin은 타인의 일정도 소프트 딜리트할 수 있다")
    void deleteSchedule_whenAdmin_shouldSoftDeleteAnySchedule() {
        // Arrange
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));

        // Act
        scheduleService.deleteSchedule(1L, 10L, 200L);

        // Assert
        assertThat(schedule.isDeleted()).isTrue();
        then(eventPublisher).should(times(1)).publishEvent(any(ScheduleDeletedEvent.class));
    }

    @Test
    @DisplayName("deleteSchedule: 소유자도 Admin도 아닌 일반 멤버가 타인 일정 삭제 시 FORBIDDEN 예외가 발생한다")
    void deleteSchedule_whenNonOwnerMember_shouldThrowForbidden() {
        // Arrange
        User anotherMemberUser = User.of(1004L, "another@test.com", "Another", null, null);
        ReflectionTestUtils.setField(anotherMemberUser, "id", 4L);
        TeamMember anotherMember = TeamMember.of(team, anotherMemberUser, TeamRole.MEMBER);
        ReflectionTestUtils.setField(anotherMember, "id", 102L);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 4L)).willReturn(Optional.of(anotherMember));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.deleteSchedule(4L, 10L, 200L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        assertThat(schedule.isDeleted()).isFalse();
        then(eventPublisher).should(never()).publishEvent(any());
    }

    // ========== getArchivedSchedules 테스트 ==========

    @Test
    @DisplayName("getArchivedSchedules: Admin은 아카이브된 일정 목록을 조회할 수 있다")
    void getArchivedSchedules_whenAdmin_shouldReturnDeletedSchedules() {
        // Arrange
        schedule.delete();
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));
        given(scheduleRepository.findArchivedByTeamId(10L)).willReturn(List.of(schedule));

        // Act
        List<ScheduleResponse> result = scheduleService.getArchivedSchedules(1L, 10L);

        // Assert
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("테스트 일정");
    }

    @Test
    @DisplayName("getArchivedSchedules: 일반 멤버가 아카이브 조회 시 FORBIDDEN 예외가 발생한다")
    void getArchivedSchedules_whenMember_shouldThrowForbidden() {
        // Arrange
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getArchivedSchedules(2L, 10L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(scheduleRepository).should(never()).findArchivedByTeamId(anyLong());
    }

    @Test
    @DisplayName("getArchivedSchedules: 팀 비멤버가 아카이브 조회 시 FORBIDDEN 예외가 발생한다")
    void getArchivedSchedules_whenNonMember_shouldThrowForbidden() {
        // Arrange
        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 3L)).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getArchivedSchedules(3L, 10L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(scheduleRepository).should(never()).findArchivedByTeamId(anyLong());
    }
}
