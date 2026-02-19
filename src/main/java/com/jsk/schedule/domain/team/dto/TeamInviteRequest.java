package com.jsk.schedule.domain.team.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class TeamInviteRequest {

    @NotNull(message = "초대 대상 카카오 ID는 필수입니다.")
    private Long kakaoId;
}
