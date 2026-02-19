package com.jsk.schedule.domain.team.service;

import com.jsk.schedule.domain.team.dto.TeamInviteRequest;
import com.jsk.schedule.domain.team.dto.TeamInviteResponse;
import com.jsk.schedule.domain.team.entity.InvitationStatus;
import com.jsk.schedule.domain.team.entity.Team;
import com.jsk.schedule.domain.team.entity.TeamInvitation;
import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.entity.TeamRole;
import com.jsk.schedule.domain.team.repository.TeamInvitationRepository;
import com.jsk.schedule.domain.team.repository.TeamMemberRepository;
import com.jsk.schedule.domain.team.repository.TeamRepository;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TeamInvitationService {

    private static final int INVITATION_EXPIRE_DAYS = 7;
    private static final int MAX_TEAM_COUNT = 10;

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final UserRepository userRepository;

    /**
     * 팀원 초대.
     * 요청자가 ADMIN이어야 하며, 이미 팀 멤버이거나 PENDING 초대가 존재하면 예외.
     */
    public TeamInviteResponse invite(Long inviterId, Long teamId, TeamInviteRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        TeamMember inviter = teamMemberRepository.findByTeamIdAndUserId(teamId, inviterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!inviter.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        Long inviteeKakaoId = request.getKakaoId();

        // 초대 대상이 이미 가입된 사용자이면서 해당 팀 멤버인지 확인
        Optional<User> inviteeUserOpt = userRepository.findByKakaoId(inviteeKakaoId);
        if (inviteeUserOpt.isPresent()) {
            User inviteeUser = inviteeUserOpt.get();
            if (teamMemberRepository.existsByTeamIdAndUserId(teamId, inviteeUser.getId())) {
                throw new BusinessException(ErrorCode.ALREADY_TEAM_MEMBER);
            }
        }

        // PENDING 상태의 중복 초대 방지
        if (teamInvitationRepository.existsByTeamIdAndInviteeKakaoIdAndStatus(
                teamId, inviteeKakaoId, InvitationStatus.PENDING)) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }

        // inviter TeamMember에서 User를 직접 참조 (중복 조회 방지)
        User inviterUser = inviter.getUser();

        String token = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(INVITATION_EXPIRE_DAYS);

        TeamInvitation invitation = TeamInvitation.create(team, inviterUser, inviteeKakaoId, token, expiresAt);
        teamInvitationRepository.save(invitation);

        log.info("팀 초대 생성 완료 — teamId={}, inviteeKakaoId={}, token={}", teamId, inviteeKakaoId, token);
        return TeamInviteResponse.from(invitation);
    }

    /**
     * 초대 수락.
     * 토큰 유효성(PENDING, 만료 미여부) 확인 후 팀 멤버로 등록.
     * 초대받은 카카오 ID와 수락 요청자의 카카오 ID가 일치해야 한다.
     * 최대 소속 팀 수(10개) 초과 시 예외.
     */
    public void acceptInvitation(Long userId, String token) {
        TeamInvitation invitation = teamInvitationRepository.findByToken(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVITATION_NOT_FOUND));

        if (!invitation.isPending()) {
            throw new BusinessException(ErrorCode.INVITATION_ALREADY_RESPONDED);
        }

        if (invitation.isExpired()) {
            invitation.expire();
            throw new BusinessException(ErrorCode.INVITATION_EXPIRED);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 초대받은 카카오 ID와 수락 요청자의 카카오 ID 일치 여부 검증
        if (!invitation.getInviteeKakaoId().equals(user.getKakaoId())) {
            log.warn("초대 수락 권한 없음 — token={}, expectedKakaoId={}, actualUserId={}",
                    token, invitation.getInviteeKakaoId(), userId);
            throw new BusinessException(ErrorCode.FORBIDDEN, "이 초대를 수락할 권한이 없습니다.");
        }

        int teamCount = teamMemberRepository.countByUserId(userId);
        if (teamCount >= MAX_TEAM_COUNT) {
            throw new BusinessException(ErrorCode.MAX_TEAM_EXCEEDED);
        }

        invitation.accept(user);

        TeamMember newMember = TeamMember.of(invitation.getTeam(), user, TeamRole.MEMBER);
        teamMemberRepository.save(newMember);

        log.info("초대 수락 완료 — teamId={}, userId={}", invitation.getTeam().getId(), userId);
    }

    /**
     * 초대 거절.
     * PENDING 상태인 초대에만 거절 가능.
     */
    public void rejectInvitation(Long userId, String token) {
        TeamInvitation invitation = teamInvitationRepository.findByToken(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVITATION_NOT_FOUND));

        if (!invitation.isPending()) {
            throw new BusinessException(ErrorCode.INVITATION_ALREADY_RESPONDED);
        }

        invitation.reject();
        log.info("초대 거절 완료 — token={}, userId={}", token, userId);
    }
}
