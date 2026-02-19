package com.jsk.schedule.domain.team.service;

import com.jsk.schedule.domain.team.dto.TeamCreateRequest;
import com.jsk.schedule.domain.team.dto.TeamMemberResponse;
import com.jsk.schedule.domain.team.dto.TeamResponse;
import com.jsk.schedule.domain.team.dto.TeamUpdateRequest;
import com.jsk.schedule.domain.team.entity.Team;
import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.entity.TeamRole;
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

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;

    /**
     * 팀 생성.
     * 첫 번째 팀 예외: 소속 팀이 없는 사용자는 최초 1회에 한해 팀 생성 가능.
     * 소속 팀이 1개 이상이면 해당 팀의 Member 또는 Admin이어야 팀 생성 가능.
     */
    public TeamResponse createTeam(Long userId, TeamCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        int teamCount = teamMemberRepository.countByUserId(userId);
        // 첫 번째 팀 예외: 소속 팀이 없으면 누구든 생성 가능
        // 소속 팀이 있으면 Member/Admin 여부가 이미 보장되어 있으므로 추가 검증 불필요
        if (teamCount == 0) {
            log.debug("첫 번째 팀 생성 허용 — userId={}", userId);
        }

        Team team = Team.create(request.getName(), request.getDescription(), user);
        teamRepository.save(team);

        TeamMember adminMember = TeamMember.of(team, user, TeamRole.ADMIN);
        teamMemberRepository.save(adminMember);

        log.info("팀 생성 완료 — teamId={}, createdByUserId={}", team.getId(), userId);
        return TeamResponse.from(team);
    }

    /**
     * 내가 소속된 팀 목록 조회.
     */
    @Transactional(readOnly = true)
    public List<TeamResponse> getMyTeams(Long userId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        List<Long> teamIds = memberships.stream()
                .map(m -> m.getTeam().getId())
                .toList();

        return teamRepository.findAllById(teamIds).stream()
                .map(TeamResponse::from)
                .toList();
    }

    /**
     * 팀 상세 조회.
     */
    @Transactional(readOnly = true)
    public TeamResponse getTeam(Long teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));
        return TeamResponse.from(team);
    }

    /**
     * 팀 정보 수정. 요청자가 해당 팀의 ADMIN이어야 한다.
     */
    public TeamResponse updateTeam(Long userId, Long teamId, TeamUpdateRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TEAM_NOT_FOUND));

        TeamMember requester = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!requester.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        team.update(request.getName(), request.getDescription());
        log.info("팀 정보 수정 완료 — teamId={}, updatedByUserId={}", teamId, userId);
        return TeamResponse.from(team);
    }

    /**
     * 팀원 목록 조회.
     */
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getTeamMembers(Long teamId) {
        if (!teamRepository.existsById(teamId)) {
            throw new BusinessException(ErrorCode.TEAM_NOT_FOUND);
        }
        return teamMemberRepository.findByTeamId(teamId).stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    /**
     * 팀원 추방. 요청자가 ADMIN이어야 하며, 본인을 추방할 수 없다.
     */
    public void removeMember(Long requesterId, Long teamId, Long targetUserId) {
        if (!teamRepository.existsById(teamId)) {
            throw new BusinessException(ErrorCode.TEAM_NOT_FOUND);
        }

        TeamMember requester = teamMemberRepository.findByTeamIdAndUserId(teamId, requesterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!requester.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        if (requesterId.equals(targetUserId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "본인을 추방할 수 없습니다. 탈퇴 기능을 이용해주세요.");
        }

        if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, targetUserId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }

        teamMemberRepository.deleteByTeamIdAndUserId(teamId, targetUserId);
        log.info("팀원 추방 완료 — teamId={}, targetUserId={}, requestedByUserId={}", teamId, targetUserId, requesterId);
    }

    /**
     * 팀 자발적 탈퇴.
     * ADMIN이 유일한 관리자인 경우, 가입일이 가장 빠른 MEMBER를 ADMIN으로 자동 승격 후 탈퇴한다.
     * 팀에 다른 멤버가 없어 승격 대상도 없으면 탈퇴 불가 안내 메시지를 반환한다.
     */
    public void leaveTeam(Long userId, Long teamId) {
        if (!teamRepository.existsById(teamId)) {
            throw new BusinessException(ErrorCode.TEAM_NOT_FOUND);
        }

        TeamMember leavingMember = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (leavingMember.isAdmin()) {
            long adminCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.ADMIN);
            if (adminCount <= 1) {
                // 승격 가능한 MEMBER가 있으면 자동 승격, 없으면 탈퇴 불가 안내
                TeamMember promotionCandidate = teamMemberRepository
                        .findFirstByTeamIdAndRoleOrderByJoinedAtAsc(teamId, TeamRole.MEMBER)
                        .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST,
                                "팀을 떠나기 전에 다른 멤버를 관리자로 지정해주세요. 현재 팀에 멤버가 없습니다."));

                promotionCandidate.changeRole(TeamRole.ADMIN);
                log.info("Admin 자동 승격 완료 — teamId={}, promotedUserId={}, triggeredByUserId={}",
                        teamId, promotionCandidate.getUser().getId(), userId);
            }
        }

        teamMemberRepository.deleteByTeamIdAndUserId(teamId, userId);
        log.info("팀 탈퇴 완료 — teamId={}, userId={}", teamId, userId);
    }

    /**
     * 팀원 역할 변경. 요청자가 ADMIN이어야 한다.
     */
    public void changeRole(Long requesterId, Long teamId, Long targetUserId, TeamRole newRole) {
        TeamMember requester = teamMemberRepository.findByTeamIdAndUserId(teamId, requesterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!requester.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        TeamMember targetMember = teamMemberRepository.findByTeamIdAndUserId(teamId, targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        targetMember.changeRole(newRole);
        log.info("역할 변경 완료 — teamId={}, targetUserId={}, newRole={}, requestedByUserId={}",
                teamId, targetUserId, newRole, requesterId);
    }
}
