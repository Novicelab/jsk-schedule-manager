package com.jsk.schedule.domain.team.dto;

import com.jsk.schedule.domain.team.entity.Team;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class TeamResponse {

    private Long id;
    private String name;
    private String description;
    private Long createdById;
    private LocalDateTime createdAt;

    public static TeamResponse from(Team team) {
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getDescription(),
                team.getCreatedBy().getId(),
                team.getCreatedAt()
        );
    }
}
