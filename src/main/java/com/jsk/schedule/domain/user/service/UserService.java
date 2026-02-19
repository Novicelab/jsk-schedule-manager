package com.jsk.schedule.domain.user.service;

import com.jsk.schedule.domain.team.dto.TeamResponse;
import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.repository.TeamMemberRepository;
import com.jsk.schedule.domain.team.repository.TeamRepository;
import com.jsk.schedule.domain.user.dto.UserProfileResponse;
import com.jsk.schedule.domain.user.dto.UserProfileUpdateRequest;
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
public class UserService {

    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;

    /**
     * 내 프로필 조회 (소속 팀 목록 포함).
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        List<Long> teamIds = memberships.stream()
                .map(m -> m.getTeam().getId())
                .toList();

        List<TeamResponse> teams = teamRepository.findAllById(teamIds).stream()
                .map(TeamResponse::from)
                .toList();

        return UserProfileResponse.of(user, teams);
    }

    /**
     * 내 프로필 수정 (이름 변경).
     */
    public UserProfileResponse updateMyProfile(Long userId, UserProfileUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        user.updateProfile(request.getName());

        log.info("프로필 수정 완료 — userId={}", userId);

        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        List<Long> teamIds = memberships.stream()
                .map(m -> m.getTeam().getId())
                .toList();

        List<TeamResponse> teams = teamRepository.findAllById(teamIds).stream()
                .map(TeamResponse::from)
                .toList();

        return UserProfileResponse.of(user, teams);
    }
}
