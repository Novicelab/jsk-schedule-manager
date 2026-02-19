package com.jsk.schedule.domain.team.repository;

import com.jsk.schedule.domain.team.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, Long> {
    // 기본 CRUD만 제공 (추후 필요 시 쿼리 메서드 추가)
}
