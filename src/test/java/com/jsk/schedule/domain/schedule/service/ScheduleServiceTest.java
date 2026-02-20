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
    private UserRepository userRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private User ownerUser;
    private User otherUser;
    private Schedule schedule;

    @BeforeEach
    void setUp() {
        // Arrange: 공통 테스트 데이터 초기화
        ownerUser = User.of(1001L, "owner@test.com", "Owner", null, "ownerToken");
        ReflectionTestUtils.setField(ownerUser, "id", 1L);

        otherUser = User.of(1002L, "other@test.com", "Other", null, "otherToken");
        ReflectionTestUtils.setField(otherUser, "id", 2L);

        schedule = Schedule.create(
                "테스트 일정",
                "일정 설명",
                ScheduleType.WORK,
                LocalDateTime.of(2026, 3, 1, 10, 0),
                LocalDateTime.of(2026, 3, 1, 12, 0),
                false,
                ownerUser
        );
        ReflectionTestUtils.setField(schedule, "id", 200L);
    }

    // ========== createSchedule 테스트 ==========

    @Test
    @DisplayName("createSchedule: 인증 사용자가 일정을 생성하면 저장 후 이벤트가 발행된다")
    void createSchedule_whenAuthenticatedUser_shouldSaveAndPublishEvent() {
        // Arrange
        ScheduleCreateRequest request = new ScheduleCreateRequest();
        ReflectionTestUtils.setField(request, "title", "신규 일정");
        ReflectionTestUtils.setField(request, "description", "설명");
        ReflectionTestUtils.setField(request, "type", ScheduleType.WORK);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 1, 9, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 1, 10, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(userRepository.findById(1L)).willReturn(Optional.of(ownerUser));
        given(scheduleRepository.save(any(Schedule.class))).willReturn(schedule);

        // Act
        ScheduleResponse response = scheduleService.createSchedule(1L, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("테스트 일정");

        then(scheduleRepository).should(times(1)).save(any(Schedule.class));
        ArgumentCaptor<ScheduleCreatedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleCreatedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("createSchedule: 존재하지 않는 사용자 ID로 요청 시 USER_NOT_FOUND 예외가 발생한다")
    void createSchedule_whenUserNotFound_shouldThrowUserNotFoundException() {
        // Arrange
        ScheduleCreateRequest request = new ScheduleCreateRequest();
        ReflectionTestUtils.setField(request, "title", "신규 일정");
        ReflectionTestUtils.setField(request, "type", ScheduleType.WORK);
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 1, 9, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 1, 10, 0));

        given(userRepository.findById(99L)).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.createSchedule(99L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.USER_NOT_FOUND);

        then(scheduleRepository).should(never()).save(any());
        then(eventPublisher).should(never()).publishEvent(any());
    }

    // ========== getSchedules 테스트 ==========

    @Test
    @DisplayName("getSchedules: 기간 내 일정 목록을 반환한다")
    void getSchedules_shouldReturnScheduleList() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        LocalDateTime start = LocalDateTime.of(2026, 3, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 3, 31, 23, 59);
        Page<Schedule> schedulePage = new PageImpl<>(List.of(schedule));

        given(scheduleRepository.findByStartAtBetween(start, end, pageable))
                .willReturn(schedulePage);

        // Act
        ScheduleListResponse response = scheduleService.getSchedules(1L, start, end, null, pageable);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getDescription()).isEqualTo("일정 설명");
    }

    @Test
    @DisplayName("getSchedules: 타입별 일정 목록을 반환한다")
    void getSchedules_whenTypeSpecified_shouldReturnScheduleListByType() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        LocalDateTime start = LocalDateTime.of(2026, 3, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 3, 31, 23, 59);
        Page<Schedule> schedulePage = new PageImpl<>(List.of(schedule));

        given(scheduleRepository.findByTypeAndStartAtBetween(ScheduleType.WORK, start, end, pageable))
                .willReturn(schedulePage);

        // Act
        ScheduleListResponse response = scheduleService.getSchedules(1L, start, end, ScheduleType.WORK, pageable);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(1);
    }

    // ========== getSchedule 테스트 ==========

    @Test
    @DisplayName("getSchedule: 일정을 조회한다")
    void getSchedule_shouldReturnSchedule() {
        // Arrange
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));

        // Act
        ScheduleResponse response = scheduleService.getSchedule(1L, 200L);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(200L);
        assertThat(response.getTitle()).isEqualTo("테스트 일정");
    }

    @Test
    @DisplayName("getSchedule: 소프트 딜리트된 일정 조회 시 SCHEDULE_ARCHIVED 예외가 발생한다")
    void getSchedule_whenDeletedSchedule_shouldThrowScheduleArchivedException() {
        // Arrange
        given(scheduleRepository.findById(200L)).willReturn(Optional.empty());
        given(scheduleRepository.findArchivedById(200L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getSchedule(1L, 200L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_ARCHIVED);
    }

    @Test
    @DisplayName("getSchedule: 존재하지 않는 일정 조회 시 SCHEDULE_NOT_FOUND 예외가 발생한다")
    void getSchedule_whenScheduleNotFound_shouldThrowScheduleNotFoundException() {
        // Arrange
        given(scheduleRepository.findById(999L)).willReturn(Optional.empty());
        given(scheduleRepository.findArchivedById(999L)).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.getSchedule(1L, 999L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_NOT_FOUND);
    }

    // ========== updateSchedule 테스트 ==========

    @Test
    @DisplayName("updateSchedule: 소유자가 수정하면 업데이트 후 이벤트가 발행된다")
    void updateSchedule_whenOwner_shouldUpdateAndPublishEvent() {
        // Arrange
        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "수정된 제목");
        ReflectionTestUtils.setField(request, "description", "수정된 설명");
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));

        // Act
        ScheduleResponse response = scheduleService.updateSchedule(1L, 200L, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("수정된 제목");
        assertThat(response.canEdit()).isTrue();

        ArgumentCaptor<ScheduleUpdatedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleUpdatedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("updateSchedule: 소유자가 아닌 사용자가 수정 시 FORBIDDEN 예외가 발생한다")
    void updateSchedule_whenNotOwner_shouldThrowForbidden() {
        // Arrange
        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "무단 수정");
        ReflectionTestUtils.setField(request, "description", "");
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));
        ReflectionTestUtils.setField(request, "allDay", false);

        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.updateSchedule(2L, 200L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(eventPublisher).should(never()).publishEvent(any());
    }

    @Test
    @DisplayName("updateSchedule: 소프트 딜리트된 일정 수정 시 SCHEDULE_ARCHIVED 예외가 발생한다")
    void updateSchedule_whenScheduleArchived_shouldThrowScheduleArchivedException() {
        // Arrange
        ScheduleUpdateRequest request = new ScheduleUpdateRequest();
        ReflectionTestUtils.setField(request, "title", "수정");
        ReflectionTestUtils.setField(request, "description", "");
        ReflectionTestUtils.setField(request, "startAt", LocalDateTime.of(2026, 3, 2, 10, 0));
        ReflectionTestUtils.setField(request, "endAt", LocalDateTime.of(2026, 3, 2, 12, 0));

        given(scheduleRepository.findById(200L)).willReturn(Optional.empty());
        given(scheduleRepository.findArchivedById(200L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.updateSchedule(1L, 200L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_ARCHIVED);
    }

    // ========== deleteSchedule 테스트 ==========

    @Test
    @DisplayName("deleteSchedule: 소유자가 삭제 요청 시 소프트 딜리트 후 이벤트가 발행된다")
    void deleteSchedule_whenOwner_shouldSoftDeleteAndPublishEvent() {
        // Arrange
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));

        // Act
        scheduleService.deleteSchedule(1L, 200L);

        // Assert
        assertThat(schedule.isDeleted()).isTrue();
        assertThat(schedule.getDeletedAt()).isNotNull();

        ArgumentCaptor<ScheduleDeletedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleDeletedEvent.class);
        then(eventPublisher).should(times(1)).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getSchedule()).isEqualTo(schedule);
    }

    @Test
    @DisplayName("deleteSchedule: 소유자가 아닌 사용자가 삭제 시 FORBIDDEN 예외가 발생한다")
    void deleteSchedule_whenNotOwner_shouldThrowForbidden() {
        // Arrange
        given(scheduleRepository.findById(200L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.deleteSchedule(2L, 200L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        assertThat(schedule.isDeleted()).isFalse();
        then(eventPublisher).should(never()).publishEvent(any());
    }

    @Test
    @DisplayName("deleteSchedule: 소프트 딜리트된 일정 삭제 시 SCHEDULE_ARCHIVED 예외가 발생한다")
    void deleteSchedule_whenScheduleArchived_shouldThrowScheduleArchivedException() {
        // Arrange
        given(scheduleRepository.findById(200L)).willReturn(Optional.empty());
        given(scheduleRepository.findArchivedById(200L)).willReturn(Optional.of(schedule));

        // Act & Assert
        assertThatThrownBy(() -> scheduleService.deleteSchedule(1L, 200L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SCHEDULE_ARCHIVED);

        assertThat(schedule.isDeleted()).isFalse();
    }

    // ========== getArchivedSchedules 테스트 ==========

    @Test
    @DisplayName("getArchivedSchedules: 아카이브된 일정 목록을 반환한다")
    void getArchivedSchedules_shouldReturnDeletedSchedules() {
        // Arrange
        schedule.delete();
        given(scheduleRepository.findArchived()).willReturn(List.of(schedule));

        // Act
        List<ScheduleResponse> result = scheduleService.getArchivedSchedules(1L);

        // Assert
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("테스트 일정");
    }
}
