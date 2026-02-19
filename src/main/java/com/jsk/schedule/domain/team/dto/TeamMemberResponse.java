package com.jsk.schedule.domain.team.dto;

import com.jsk.schedule.domain.team.entity.TeamMember;
import com.jsk.schedule.domain.team.entity.TeamRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class TeamMemberResponse {

    private Long userId;
    private String name;
    private String email;
    private String profileImageUrl;
    private TeamRole role;
    private LocalDateTime joinedAt;

    public static TeamMemberResponse from(TeamMember teamMember) {
        return new TeamMemberResponse(
                teamMember.getUser().getId(),
                teamMember.getUser().getName(),
                teamMember.getUser().getEmail(),
                teamMember.getUser().getProfileImageUrl(),
                teamMember.getRole(),
                teamMember.getJoinedAt()
        );
    }
}
