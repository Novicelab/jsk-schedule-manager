package com.jsk.schedule.domain.team.dto;

import com.jsk.schedule.domain.team.entity.TeamInvitation;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class TeamInviteResponse {

    private Long invitationId;
    private String token;
    private Long teamId;
    private String teamName;
    private LocalDateTime expiresAt;

    public static TeamInviteResponse from(TeamInvitation invitation) {
        return new TeamInviteResponse(
                invitation.getId(),
                invitation.getToken(),
                invitation.getTeam().getId(),
                invitation.getTeam().getName(),
                invitation.getExpiresAt()
        );
    }
}
