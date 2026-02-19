package com.jsk.schedule.domain.team.repository;

import com.jsk.schedule.domain.team.entity.InvitationStatus;
import com.jsk.schedule.domain.team.entity.TeamInvitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {

    /**
     * 초대 토큰으로 초대 조회 — 수락/거절 처리 시 사용
     */
    Optional<TeamInvitation> findByToken(String token);

    /**
     * 중복 초대 방지 — 동일 팀에 동일 카카오 ID로 PENDING 상태 초대가 존재하는지 확인
     */
    boolean existsByTeamIdAndInviteeKakaoIdAndStatus(Long teamId, Long inviteeKakaoId,
                                                     InvitationStatus status);
}
