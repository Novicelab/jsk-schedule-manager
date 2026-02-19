package com.jsk.schedule.domain.team.dto;

import com.jsk.schedule.domain.team.entity.TeamRole;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ChangeRoleRequest {

    @NotNull(message = "변경할 역할은 필수입니다.")
    private TeamRole role;
}
