package com.jsk.schedule.domain.team.repository;

import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.entity.TeamRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    Optional<TeamMember> findByTeamIdAndUserId(Long teamId, Long userId);

    List<TeamMember> findByTeamId(Long teamId);

    List<TeamMember> findByUserId(Long userId);

    boolean existsByTeamIdAndUserId(Long teamId, Long userId);

    /**
     * 특정 사용자의 소속 팀 수 조회 — 최대 10개 정책 적용 시 사용
     */
    int countByUserId(Long userId);

    /**
     * 특정 팀의 특정 역할을 가진 멤버 수 조회 — 유일 Admin 탈퇴 처리 시 사용
     */
    long countByTeamIdAndRole(Long teamId, TeamRole role);

    /**
     * 특정 팀에서 특정 역할을 가진 멤버를 가입일 오름차순으로 조회 — Admin 승격 대상 선택 시 사용
     */
    Optional<TeamMember> findFirstByTeamIdAndRoleOrderByJoinedAtAsc(Long teamId, TeamRole role);

    @Transactional
    void deleteByTeamIdAndUserId(Long teamId, Long userId);
}
