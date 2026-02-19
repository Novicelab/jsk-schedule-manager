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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
@DisplayName("TeamInvitationService 단위 테스트")
class TeamInvitationServiceTest {

    @InjectMocks
    private TeamInvitationService teamInvitationService;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private TeamInvitationRepository teamInvitationRepository;

    @Mock
    private UserRepository userRepository;

    private User adminUser;
    private User memberUser;
    private User inviteeUser;
    private Team team;
    private TeamMember adminMember;
    private TeamMember regularMember;

    @BeforeEach
    void setUp() {
        adminUser = User.of(1001L, "admin@test.com", "Admin", null, "adminToken");
        ReflectionTestUtils.setField(adminUser, "id", 1L);

        memberUser = User.of(1002L, "member@test.com", "Member", null, "memberToken");
        ReflectionTestUtils.setField(memberUser, "id", 2L);

        inviteeUser = User.of(9999L, "invitee@test.com", "Invitee", null, null);
        ReflectionTestUtils.setField(inviteeUser, "id", 5L);

        team = Team.create("테스트팀", "팀 설명", adminUser);
        ReflectionTestUtils.setField(team, "id", 10L);

        adminMember = TeamMember.of(team, adminUser, TeamRole.ADMIN);
        ReflectionTestUtils.setField(adminMember, "id", 100L);

        regularMember = TeamMember.of(team, memberUser, TeamRole.MEMBER);
        ReflectionTestUtils.setField(regularMember, "id", 101L);
    }

    // ========== invite 테스트 ==========

    @Test
    @DisplayName("invite: Admin이 신규 사용자를 초대하면 초대 엔티티가 저장된다")
    void invite_whenAdmin_shouldSaveInvitation() {
        // Arrange
        TeamInviteRequest request = new TeamInviteRequest();
        ReflectionTestUtils.setField(request, "kakaoId", 9999L);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));
        given(userRepository.findByKakaoId(9999L)).willReturn(Optional.empty());
        given(teamInvitationRepository.existsByTeamIdAndInviteeKakaoIdAndStatus(
                10L, 9999L, InvitationStatus.PENDING)).willReturn(false);
        given(teamInvitationRepository.save(any(TeamInvitation.class)))
                .willAnswer(inv -> inv.getArgument(0));

        // Act
        TeamInviteResponse response = teamInvitationService.invite(1L, 10L, request);

        // Assert
        assertThat(response).isNotNull();
        then(teamInvitationRepository).should(times(1)).save(any(TeamInvitation.class));
    }

    @Test
    @DisplayName("invite: 일반 멤버가 초대 시도 시 FORBIDDEN 예외가 발생한다")
    void invite_whenNonAdmin_shouldThrowForbidden() {
        // Arrange
        TeamInviteRequest request = new TeamInviteRequest();
        ReflectionTestUtils.setField(request, "kakaoId", 9999L);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 2L)).willReturn(Optional.of(regularMember));

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.invite(2L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        then(teamInvitationRepository).should(never()).save(any());
    }

    @Test
    @DisplayName("invite: 이미 팀 멤버인 사용자를 초대 시 ALREADY_TEAM_MEMBER 예외가 발생한다")
    void invite_whenAlreadyTeamMember_shouldThrowAlreadyTeamMember() {
        // Arrange
        TeamInviteRequest request = new TeamInviteRequest();
        ReflectionTestUtils.setField(request, "kakaoId", 1002L); // memberUser의 kakaoId

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));
        given(userRepository.findByKakaoId(1002L)).willReturn(Optional.of(memberUser));
        given(teamMemberRepository.existsByTeamIdAndUserId(10L, 2L)).willReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.invite(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ALREADY_TEAM_MEMBER);
    }

    @Test
    @DisplayName("invite: PENDING 상태의 중복 초대 시 CONFLICT 예외가 발생한다")
    void invite_whenDuplicatePendingInvitation_shouldThrowConflict() {
        // Arrange
        TeamInviteRequest request = new TeamInviteRequest();
        ReflectionTestUtils.setField(request, "kakaoId", 9999L);

        given(teamRepository.findById(10L)).willReturn(Optional.of(team));
        given(teamMemberRepository.findByTeamIdAndUserId(10L, 1L)).willReturn(Optional.of(adminMember));
        given(userRepository.findByKakaoId(9999L)).willReturn(Optional.empty());
        given(teamInvitationRepository.existsByTeamIdAndInviteeKakaoIdAndStatus(
                10L, 9999L, InvitationStatus.PENDING)).willReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.invite(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
    }

    // ========== acceptInvitation 테스트 ==========

    @Test
    @DisplayName("acceptInvitation: 유효한 토큰으로 수락하면 팀 멤버로 등록된다")
    void acceptInvitation_whenValidToken_shouldAddTeamMember() {
        // Arrange
        TeamInvitation invitation = TeamInvitation.create(
                team, adminUser, 9999L, "validToken",
                LocalDateTime.now().plusDays(7)
        );
        ReflectionTestUtils.setField(invitation, "id", 50L);

        given(teamInvitationRepository.findByToken("validToken")).willReturn(Optional.of(invitation));
        given(userRepository.findById(5L)).willReturn(Optional.of(inviteeUser));
        given(teamMemberRepository.countByUserId(5L)).willReturn(0);
        given(teamMemberRepository.save(any(TeamMember.class))).willAnswer(inv -> inv.getArgument(0));

        // Act
        teamInvitationService.acceptInvitation(5L, "validToken");

        // Assert
        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        assertThat(invitation.getInvitee()).isEqualTo(inviteeUser);

        ArgumentCaptor<TeamMember> memberCaptor = ArgumentCaptor.forClass(TeamMember.class);
        then(teamMemberRepository).should(times(1)).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().getRole()).isEqualTo(TeamRole.MEMBER);
    }

    @Test
    @DisplayName("acceptInvitation: 만료된 초대 토큰으로 수락 시 INVITATION_EXPIRED 예외가 발생한다")
    void acceptInvitation_whenExpiredToken_shouldThrowInvitationExpired() {
        // Arrange
        TeamInvitation expiredInvitation = TeamInvitation.create(
                team, adminUser, 9999L, "expiredToken",
                LocalDateTime.now().minusDays(1) // 이미 만료
        );

        given(teamInvitationRepository.findByToken("expiredToken")).willReturn(Optional.of(expiredInvitation));
        given(userRepository.findById(5L)).willReturn(Optional.of(inviteeUser));

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.acceptInvitation(5L, "expiredToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVITATION_EXPIRED);

        then(teamMemberRepository).should(never()).save(any());
    }

    @Test
    @DisplayName("acceptInvitation: 이미 응답된 초대 수락 시 INVITATION_ALREADY_RESPONDED 예외가 발생한다")
    void acceptInvitation_whenAlreadyResponded_shouldThrowAlreadyResponded() {
        // Arrange
        TeamInvitation acceptedInvitation = TeamInvitation.create(
                team, adminUser, 9999L, "acceptedToken",
                LocalDateTime.now().plusDays(7)
        );
        acceptedInvitation.accept(inviteeUser); // 이미 수락된 상태

        given(teamInvitationRepository.findByToken("acceptedToken"))
                .willReturn(Optional.of(acceptedInvitation));

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.acceptInvitation(5L, "acceptedToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVITATION_ALREADY_RESPONDED);
    }

    @Test
    @DisplayName("acceptInvitation: 최대 팀 수(10개) 초과 시 MAX_TEAM_EXCEEDED 예외가 발생한다")
    void acceptInvitation_whenMaxTeamExceeded_shouldThrowMaxTeamExceeded() {
        // Arrange
        TeamInvitation invitation = TeamInvitation.create(
                team, adminUser, 9999L, "validToken",
                LocalDateTime.now().plusDays(7)
        );

        given(teamInvitationRepository.findByToken("validToken")).willReturn(Optional.of(invitation));
        given(userRepository.findById(5L)).willReturn(Optional.of(inviteeUser));
        given(teamMemberRepository.countByUserId(5L)).willReturn(10); // 최대 10개 초과

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.acceptInvitation(5L, "validToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.MAX_TEAM_EXCEEDED);

        then(teamMemberRepository).should(never()).save(any());
    }

    // ========== rejectInvitation 테스트 ==========

    @Test
    @DisplayName("rejectInvitation: 유효한 PENDING 초대 거절 시 상태가 REJECTED로 변경된다")
    void rejectInvitation_whenPendingInvitation_shouldRejectSuccessfully() {
        // Arrange
        TeamInvitation invitation = TeamInvitation.create(
                team, adminUser, 9999L, "pendingToken",
                LocalDateTime.now().plusDays(7)
        );

        given(teamInvitationRepository.findByToken("pendingToken")).willReturn(Optional.of(invitation));

        // Act
        teamInvitationService.rejectInvitation(5L, "pendingToken");

        // Assert
        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.REJECTED);
        assertThat(invitation.getRespondedAt()).isNotNull();
    }

    @Test
    @DisplayName("rejectInvitation: 존재하지 않는 초대 토큰 거절 시 INVITATION_NOT_FOUND 예외가 발생한다")
    void rejectInvitation_whenTokenNotFound_shouldThrowInvitationNotFound() {
        // Arrange
        given(teamInvitationRepository.findByToken("unknownToken")).willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.rejectInvitation(5L, "unknownToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVITATION_NOT_FOUND);
    }

    @Test
    @DisplayName("rejectInvitation: 이미 응답된 초대 거절 시 INVITATION_ALREADY_RESPONDED 예외가 발생한다")
    void rejectInvitation_whenAlreadyResponded_shouldThrowAlreadyResponded() {
        // Arrange
        TeamInvitation rejectedInvitation = TeamInvitation.create(
                team, adminUser, 9999L, "rejectedToken",
                LocalDateTime.now().plusDays(7)
        );
        rejectedInvitation.reject(); // 이미 거절된 상태

        given(teamInvitationRepository.findByToken("rejectedToken"))
                .willReturn(Optional.of(rejectedInvitation));

        // Act & Assert
        assertThatThrownBy(() -> teamInvitationService.rejectInvitation(5L, "rejectedToken"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVITATION_ALREADY_RESPONDED);
    }
}
