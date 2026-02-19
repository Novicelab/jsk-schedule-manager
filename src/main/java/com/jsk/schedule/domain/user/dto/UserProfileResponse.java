package com.jsk.schedule.domain.user.dto;

import com.jsk.schedule.domain.team.dto.TeamResponse;
import com.jsk.schedule.domain.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class UserProfileResponse {

    private Long id;
    private String name;
    private String email;
    private String profileImageUrl;
    private List<TeamResponse> teams;

    public static UserProfileResponse of(User user, List<TeamResponse> teams) {
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getProfileImageUrl(),
                teams
        );
    }
}
