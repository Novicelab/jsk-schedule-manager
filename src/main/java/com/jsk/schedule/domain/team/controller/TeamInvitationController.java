package com.jsk.schedule.domain.team.controller;

import com.jsk.schedule.domain.team.dto.TeamInviteRequest;
import com.jsk.schedule.domain.team.dto.TeamInviteResponse;
import com.jsk.schedule.domain.team.service.TeamInvitationService;
import com.jsk.schedule.global.common.ApiResponse;
import com.jsk.schedule.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TeamInvitationController {

    private final TeamInvitationService teamInvitationService;

    @PostMapping("/api/teams/{teamId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TeamInviteResponse> invite(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @Valid @RequestBody TeamInviteRequest request) {
        TeamInviteResponse response = teamInvitationService.invite(userDetails.userId(), teamId, request);
        return ApiResponse.success(response);
    }

    @PostMapping("/api/invitations/{token}/accept")
    public ApiResponse<Void> acceptInvitation(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable String token) {
        teamInvitationService.acceptInvitation(userDetails.userId(), token);
        return ApiResponse.success();
    }

    @PostMapping("/api/invitations/{token}/reject")
    public ApiResponse<Void> rejectInvitation(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable String token) {
        teamInvitationService.rejectInvitation(userDetails.userId(), token);
        return ApiResponse.success();
    }
}
