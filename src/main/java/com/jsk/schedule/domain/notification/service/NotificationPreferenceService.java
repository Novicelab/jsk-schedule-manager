package com.jsk.schedule.domain.notification.service;

import com.jsk.schedule.domain.notification.dto.NotificationPreferenceResponse;
import com.jsk.schedule.domain.notification.entity.NotificationActionType;
import com.jsk.schedule.domain.notification.entity.NotificationPreference;
import com.jsk.schedule.domain.notification.repository.NotificationPreferenceRepository;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 사용자별 알림 수신 설정 서비스.
 * 가입 시 기본값(모두 true) 초기화, 조회, 개별 업데이트를 담당한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final UserRepository userRepository;

    /**
     * 신규 사용자 가입 시 기본 알림 설정 6개를 생성한다 (VACATION/WORK × CREATED/UPDATED/DELETED).
     * 모든 항목의 초기값은 true(수신 허용)이다.
     */
    @Transactional
    public void initializeDefaultPreferences(User user) {
        List<NotificationPreference> defaults = new ArrayList<>();
        for (ScheduleType scheduleType : ScheduleType.values()) {
            for (NotificationActionType actionType : NotificationActionType.values()) {
                defaults.add(NotificationPreference.builder()
                        .user(user)
                        .scheduleType(scheduleType)
                        .actionType(actionType)
                        .enabled(true)
                        .build());
            }
        }
        notificationPreferenceRepository.saveAll(defaults);
        log.debug("알림 기본 설정 초기화 완료: userId={}", user.getId());
    }

    /**
     * 사용자의 전체 알림 설정 목록을 조회한다.
     * 설정이 없는 경우 기본값으로 초기화 후 반환한다.
     * readOnly 트랜잭션이 아닌 일반 트랜잭션으로 처리하여 초기화 쓰기를 허용한다.
     */
    @Transactional
    public List<NotificationPreferenceResponse> getPreferences(Long userId) {
        List<NotificationPreference> prefs = notificationPreferenceRepository.findByUserId(userId);
        if (prefs.isEmpty()) {
            log.info("알림 설정 없음, 기본값 초기화: userId={}", userId);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            initializeDefaultPreferences(user);
            prefs = notificationPreferenceRepository.findByUserId(userId);
        }
        return prefs.stream()
                .map(NotificationPreferenceResponse::from)
                .toList();
    }

    /**
     * 특정 알림 설정(key)의 활성화 여부를 업데이트한다.
     * key 형식: "VACATION_CREATED", "WORK_DELETED" 등
     */
    @Transactional
    public NotificationPreferenceResponse updatePreference(Long userId, String key, boolean enabled) {
        String[] parts = parseKey(key);
        ScheduleType scheduleType = parseScheduleType(parts[0]);
        NotificationActionType actionType = parseActionType(parts[1]);

        NotificationPreference pref = notificationPreferenceRepository
                .findByUserIdAndScheduleTypeAndActionType(userId, scheduleType, actionType)
                .orElseGet(() -> {
                    // 설정이 없는 경우 사용자를 조회하여 신규 생성
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
                    return NotificationPreference.builder()
                            .user(user)
                            .scheduleType(scheduleType)
                            .actionType(actionType)
                            .enabled(true)
                            .build();
                });

        pref.setEnabled(enabled);
        NotificationPreference saved = notificationPreferenceRepository.save(pref);
        log.debug("알림 설정 업데이트: userId={}, key={}, enabled={}", userId, key, enabled);
        return NotificationPreferenceResponse.from(saved);
    }

    /**
     * 알림 발송 전 사용자의 수신 여부를 확인한다.
     * 설정 레코드가 없으면 기본값 true(수신 허용)를 반환한다.
     */
    public boolean isNotificationEnabled(Long userId, ScheduleType scheduleType,
                                         NotificationActionType actionType) {
        return notificationPreferenceRepository
                .findByUserIdAndScheduleTypeAndActionType(userId, scheduleType, actionType)
                .map(NotificationPreference::isEnabled)
                .orElse(true);
    }

    // --- private helpers ---

    private String[] parseKey(String key) {
        String[] parts = key.split("_", 2);
        if (parts.length != 2) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "알림 설정 키 형식이 올바르지 않습니다. 형식: SCHEDULE_TYPE_ACTION_TYPE (예: VACATION_CREATED)");
        }
        return parts;
    }

    private ScheduleType parseScheduleType(String value) {
        try {
            return ScheduleType.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "지원하지 않는 일정 유형입니다: " + value);
        }
    }

    private NotificationActionType parseActionType(String value) {
        try {
            return NotificationActionType.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "지원하지 않는 액션 유형입니다: " + value);
        }
    }
}
