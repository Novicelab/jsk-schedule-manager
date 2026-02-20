package com.jsk.schedule.domain.notification.service;

import com.jsk.schedule.domain.notification.dto.NotificationResponse;
import com.jsk.schedule.domain.notification.entity.Notification;
import com.jsk.schedule.domain.notification.entity.NotificationType;
import com.jsk.schedule.domain.notification.repository.NotificationRepository;
import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.infra.kakao.KakaoApiClient;
import com.jsk.schedule.infra.kakao.dto.KakaoAlimtalkResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 알림 발송 및 이력 조회 서비스.
 * 비동기 컨텍스트(@Async)에서 호출되므로 각 메서드는 독립 트랜잭션으로 동작한다.
 * 발송 실패는 CRUD 트랜잭션에 영향 없이 로그 기록 후 계속 진행한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_RETRY_COUNT = 3;
    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final KakaoApiClient kakaoApiClient;

    /**
     * 일정 이벤트 발생 시 카카오 AccessToken이 있는 모든 사용자에게 알림을 발송한다.
     * 각 사용자별로 알림 이력을 저장하고 카카오 API를 호출한다.
     * 개별 사용자 발송 실패는 다른 사용자의 발송에 영향을 주지 않는다.
     *
     * @param schedule 알림 대상 일정
     * @param type     알림 유형 (SCHEDULE_CREATED / UPDATED / DELETED)
     */
    @Transactional
    public void sendScheduleNotification(Schedule schedule, NotificationType type) {
        List<User> users = userRepository.findAllByKakaoAccessTokenIsNotNull();

        if (users.isEmpty()) {
            log.debug("알림 발송 대상 사용자 없음");
            return;
        }

        String message = buildMessage(schedule, type);
        log.debug("일정 알림 발송 시작: scheduleId={}, type={}, 사용자 수={}",
                schedule.getId(), type, users.size());

        for (User user : users) {
            sendNotificationToUser(schedule, user, type, message);
        }
    }

    /**
     * 특정 사용자에 대해 알림 저장 및 카카오 API 발송을 처리한다.
     * 최대 3회 재시도하며, 최종 실패 시 FAILED 상태로 기록하고 예외를 전파하지 않는다.
     */
    private void sendNotificationToUser(Schedule schedule, User user,
                                        NotificationType type, String message) {
        Notification notification = Notification.create(schedule, user, type, message);
        notificationRepository.save(notification);

        boolean sent = false;
        for (int attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
            try {
                String kakaoAccessToken = user.getKakaoAccessToken();
                if (kakaoAccessToken == null || kakaoAccessToken.isBlank()) {
                    log.warn("카카오 Access Token 없음: userId={}, 알림 발송 건너뜀", user.getId());
                    break;
                }

                KakaoAlimtalkResponse response = kakaoApiClient.sendAlimtalk(kakaoAccessToken, message);
                if (response != null && response.isSuccess()) {
                    notification.markSuccess();
                    notificationRepository.save(notification);
                    sent = true;
                    log.debug("알림 발송 성공: userId={}, attempt={}", user.getId(), attempt);
                    break;
                } else {
                    log.warn("알림 발송 실패 응답: userId={}, attempt={}", user.getId(), attempt);
                }
            } catch (BusinessException e) {
                log.warn("알림 발송 API 오류: userId={}, attempt={}, error={}",
                        user.getId(), attempt, e.getMessage());
            } catch (Exception e) {
                log.warn("알림 발송 중 예기치 못한 오류: userId={}, attempt={}", user.getId(), attempt, e);
            }
        }

        if (!sent) {
            notification.markFailed();
            notificationRepository.save(notification);
            log.error("알림 발송 최종 실패 ({}회 시도): userId={}, scheduleId={}",
                    MAX_RETRY_COUNT, user.getId(), schedule.getId());
        }
    }

    /**
     * 알림 유형에 맞는 메시지를 생성한다.
     *
     * @param schedule 일정 엔티티
     * @param type     알림 유형
     * @return 발송할 메시지 문자열
     */
    private String buildMessage(Schedule schedule, NotificationType type) {
        return switch (type) {
            case SCHEDULE_CREATED -> String.format(
                    "[JSK] 새 일정이 등록되었습니다.\n제목: %s\n시작: %s\n종료: %s",
                    schedule.getTitle(),
                    schedule.getStartAt().format(DATE_TIME_FORMATTER),
                    schedule.getEndAt().format(DATE_TIME_FORMATTER)
            );
            case SCHEDULE_UPDATED -> String.format(
                    "[JSK] 일정이 수정되었습니다.\n제목: %s\n시작: %s\n종료: %s",
                    schedule.getTitle(),
                    schedule.getStartAt().format(DATE_TIME_FORMATTER),
                    schedule.getEndAt().format(DATE_TIME_FORMATTER)
            );
            case SCHEDULE_DELETED -> String.format(
                    "[JSK] 일정이 삭제되었습니다.\n제목: %s",
                    schedule.getTitle()
            );
            default -> throw new IllegalArgumentException("지원하지 않는 알림 유형: " + type);
        };
    }

    /**
     * 로그인 사용자의 알림 이력을 최신순으로 조회한다.
     *
     * @param userId 조회 대상 사용자 ID
     * @return 알림 응답 DTO 목록 (최신순)
     */
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(Long userId) {
        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return notifications.stream()
                .map(NotificationResponse::from)
                .toList();
    }
}
