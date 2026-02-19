package com.jsk.schedule.domain.schedule.repository;

import com.jsk.schedule.domain.schedule.entity.Schedule;
import com.jsk.schedule.domain.schedule.entity.ScheduleType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    /**
     * 팀별 기간 내 일정 조회 (리스트).
     * @SQLRestriction("deleted_at IS NULL")이 자동 적용되어 소프트 딜리트된 일정은 제외됨.
     */
    List<Schedule> findByTeamIdAndStartAtBetween(Long teamId, LocalDateTime start, LocalDateTime end);

    /**
     * 팀별 기간 내 일정 페이징 조회 (type 전체).
     * @SQLRestriction("deleted_at IS NULL")이 자동 적용되어 소프트 딜리트된 일정은 제외됨.
     */
    Page<Schedule> findByTeamIdAndStartAtBetween(Long teamId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    /**
     * 팀별 기간 내 특정 type 일정 페이징 조회.
     * @SQLRestriction("deleted_at IS NULL")이 자동 적용되어 소프트 딜리트된 일정은 제외됨.
     */
    @Query("SELECT s FROM Schedule s WHERE s.team.id = :teamId AND s.type = :type AND s.startAt BETWEEN :start AND :end")
    Page<Schedule> findByTeamIdAndTypeAndStartAtBetween(
            @Param("teamId") Long teamId,
            @Param("type") ScheduleType type,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);

    /**
     * 아카이브 조회 — 소프트 딜리트된 일정만 반환.
     * @SQLRestriction을 우회하기 위해 JPQL로 직접 조건 지정.
     */
    @Query("SELECT s FROM Schedule s WHERE s.team.id = :teamId AND s.deletedAt IS NOT NULL")
    List<Schedule> findArchivedByTeamId(@Param("teamId") Long teamId);

    /**
     * 소프트 딜리트된 일정 단건 조회 — 삭제된 일정 접근 시 원인 구분을 위해 사용.
     * @SQLRestriction을 우회하기 위해 JPQL로 직접 조건 지정.
     */
    @Query("SELECT s FROM Schedule s WHERE s.id = :scheduleId AND s.team.id = :teamId AND s.deletedAt IS NOT NULL")
    Optional<Schedule> findArchivedByIdAndTeamId(@Param("scheduleId") Long scheduleId, @Param("teamId") Long teamId);
}
