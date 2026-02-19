package com.jsk.schedule.domain.notification.repository;

import com.jsk.schedule.domain.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /**
     * 사용자별 알림 목록 조회 — 최신순 정렬
     */
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
}
