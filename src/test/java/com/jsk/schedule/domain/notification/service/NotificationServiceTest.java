package com.jsk.schedule.domain.notification.service;

import com.jsk.schedule.domain.notification.dto.NotificationResponse;
import com.jsk.schedule.domain.notification.entity.Notification;
import com.jsk.schedule.domain.notification.entity.NotificationStatus;
import com.jsk.schedule.domain.notification.entity.NotificationType;
import com.jsk.schedule.domain.notification.repository.NotificationRepository;
import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.infra.kakao.KakaoApiClient;
import com.jsk.schedule.infra.kakao.dto.KakaoAlimtalkResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService 단위 테스트")
class NotificationServiceTest {

    @InjectMocks
    private NotificationService notificationService;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private KakaoApiClient kakaoApiClient;

    private User user1;
    private User user2;
    private Schedule schedule;

    @BeforeEach
    void setUp() {
        user1 = User.of(1001L, "user1@test.com", "User1", null, "kakaoToken1");
        ReflectionTestUtils.setField(user1, "id", 1L);

        user2 = User.of(1002L, "user2@test.com", "User2", null, "kakaoToken2");
        ReflectionTestUtils.setField(user2, "id", 2L);

        schedule = Schedule.create(
                "테스트 일정", "설명", ScheduleType.WORK,
                LocalDateTime.of(2026, 3, 1, 10, 0),
                LocalDateTime.of(2026, 3, 1, 12, 0),
                false, user1
        );
        ReflectionTestUtils.setField(schedule, "id", 200L);
    }

    // ========== sendScheduleNotification 테스트 ==========

    @Test
    @DisplayName("sendScheduleNotification: 카카오 토큰이 있는 모든 사용자에게 알림을 발송한다")
    void sendScheduleNotification_shouldSaveNotificationForAllUsers() {
        // Arrange
        KakaoAlimtalkResponse successResponse = new KakaoAlimtalkResponse();

        given(userRepository.findAllByKakaoAccessTokenIsNotNull()).willReturn(List.of(user1, user2));
        given(notificationRepository.save(any(Notification.class))).willAnswer(inv -> inv.getArgument(0));
        given(kakaoApiClient.sendAlimtalk(anyString(), anyString())).willReturn(successResponse);

        // Act
        notificationService.sendScheduleNotification(schedule, NotificationType.SCHEDULE_CREATED);

        // Assert
        // 2명 사용자: 최초 저장(PENDING) + 성공 후 업데이트(SUCCESS) 각 2번 = 총 4번 save
        then(notificationRepository).should(times(4)).save(any(Notification.class));
        then(kakaoApiClient).should(times(2)).sendAlimtalk(anyString(), anyString());
    }

    @Test
    @DisplayName("sendScheduleNotification: 카카오 토큰이 있는 사용자가 없으면 알림을 발송하지 않는다")
    void sendScheduleNotification_whenNoUsersWithToken_shouldNotSendNotification() {
        // Arrange
        given(userRepository.findAllByKakaoAccessTokenIsNotNull()).willReturn(List.of());

        // Act
        notificationService.sendScheduleNotification(schedule, NotificationType.SCHEDULE_CREATED);

        // Assert
        then(notificationRepository).should(never()).save(any());
        then(kakaoApiClient).should(never()).sendAlimtalk(anyString(), anyString());
    }

    @Test
    @DisplayName("sendScheduleNotification: 카카오 Access Token이 없는 사용자는 알림 발송을 건너뛰고 FAILED로 기록된다")
    void sendScheduleNotification_whenNoKakaoToken_shouldSkipAndMarkFailed() {
        // Arrange
        User noTokenUser = User.of(1003L, "notoken@test.com", "NoToken", null, null); // token=null
        ReflectionTestUtils.setField(noTokenUser, "id", 3L);

        given(userRepository.findAllByKakaoAccessTokenIsNotNull()).willReturn(List.of(noTokenUser));
        given(notificationRepository.save(any(Notification.class))).willAnswer(inv -> inv.getArgument(0));

        // Act
        notificationService.sendScheduleNotification(schedule, NotificationType.SCHEDULE_CREATED);

        // Assert
        then(kakaoApiClient).should(never()).sendAlimtalk(anyString(), anyString());

        // FAILED 상태 저장 확인: 최초 PENDING 저장 + FAILED 업데이트 저장 = 2번
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        then(notificationRepository).should(times(2)).save(captor.capture());
        List<Notification> savedNotifications = captor.getAllValues();
        assertThat(savedNotifications.get(1).getStatus()).isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("sendScheduleNotification: 카카오 API 실패 시 FAILED 상태로 기록되고 예외를 전파하지 않는다")
    void sendScheduleNotification_whenKakaoApiFails_shouldMarkFailedAndNotThrow() {
        // Arrange
        given(userRepository.findAllByKakaoAccessTokenIsNotNull()).willReturn(List.of(user1));
        given(notificationRepository.save(any(Notification.class))).willAnswer(inv -> inv.getArgument(0));
        given(kakaoApiClient.sendAlimtalk(anyString(), anyString()))
                .willThrow(new RuntimeException("카카오 API 연결 실패"));

        // Act (예외 전파 없이 정상 종료 확인)
        notificationService.sendScheduleNotification(schedule, NotificationType.SCHEDULE_CREATED);

        // Assert
        // 재시도 3회 모두 실패 → FAILED 저장
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        // 최초 PENDING 저장 1번 + MAX_RETRY(3회) 시도 후 FAILED 저장 1번 = 2번
        then(notificationRepository).should(times(2)).save(captor.capture());
        List<Notification> savedList = captor.getAllValues();
        assertThat(savedList.get(1).getStatus()).isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("sendScheduleNotification: 일정 삭제 메시지는 제목만 포함된다")
    void sendScheduleNotification_whenDeleted_shouldSendTitleOnlyMessage() {
        // Arrange
        KakaoAlimtalkResponse successResponse = new KakaoAlimtalkResponse();

        given(userRepository.findAllByKakaoAccessTokenIsNotNull()).willReturn(List.of(user1));
        given(notificationRepository.save(any(Notification.class))).willAnswer(inv -> inv.getArgument(0));
        given(kakaoApiClient.sendAlimtalk(anyString(), anyString())).willReturn(successResponse);

        // Act
        notificationService.sendScheduleNotification(schedule, NotificationType.SCHEDULE_DELETED);

        // Assert
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        then(kakaoApiClient).should(times(1))
                .sendAlimtalk(anyString(), messageCaptor.capture());
        String sentMessage = messageCaptor.getValue();
        assertThat(sentMessage).contains("일정이 삭제되었습니다");
        assertThat(sentMessage).contains("테스트 일정");
    }

    // ========== getMyNotifications 테스트 ==========

    @Test
    @DisplayName("getMyNotifications: 로그인 사용자의 알림 이력을 최신순으로 반환한다")
    void getMyNotifications_shouldReturnNotificationsOrderedByLatest() {
        // Arrange
        Notification notification1 = Notification.create(schedule, user1, NotificationType.SCHEDULE_CREATED, "메시지1");
        ReflectionTestUtils.setField(notification1, "id", 1L);
        ReflectionTestUtils.setField(notification1, "createdAt", LocalDateTime.of(2026, 3, 1, 10, 0));

        Notification notification2 = Notification.create(schedule, user1, NotificationType.SCHEDULE_UPDATED, "메시지2");
        ReflectionTestUtils.setField(notification2, "id", 2L);
        ReflectionTestUtils.setField(notification2, "createdAt", LocalDateTime.of(2026, 3, 2, 10, 0));

        given(notificationRepository.findByUserIdOrderByCreatedAtDesc(1L))
                .willReturn(List.of(notification2, notification1)); // 최신순

        // Act
        List<NotificationResponse> result = notificationService.getMyNotifications(1L);

        // Assert
        assertThat(result).hasSize(2);
        assertThat(result.get(0).getType()).isEqualTo(NotificationType.SCHEDULE_UPDATED);
        assertThat(result.get(1).getType()).isEqualTo(NotificationType.SCHEDULE_CREATED);
    }

    @Test
    @DisplayName("getMyNotifications: 알림 이력이 없으면 빈 목록을 반환한다")
    void getMyNotifications_whenNoNotifications_shouldReturnEmptyList() {
        // Arrange
        given(notificationRepository.findByUserIdOrderByCreatedAtDesc(1L)).willReturn(List.of());

        // Act
        List<NotificationResponse> result = notificationService.getMyNotifications(1L);

        // Assert
        assertThat(result).isEmpty();
    }
}
