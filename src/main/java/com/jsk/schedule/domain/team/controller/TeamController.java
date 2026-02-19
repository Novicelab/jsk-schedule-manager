package com.jsk.schedule.domain.team.controller;

import com.jsk.schedule.domain.team.dto.ChangeRoleRequest;
import com.jsk.schedule.domain.team.dto.TeamCreateRequest;
import com.jsk.schedule.domain.team.dto.TeamMemberResponse;
import com.jsk.schedule.domain.team.dto.TeamResponse;
import com.jsk.schedule.domain.team.dto.TeamUpdateRequest;
import com.jsk.schedule.domain.team.service.TeamService;
import com.jsk.schedule.global.common.ApiResponse;
import com.jsk.schedule.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TeamResponse> createTeam(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody TeamCreateRequest request) {
        TeamResponse response = teamService.createTeam(userDetails.userId(), request);
        return ApiResponse.success(response);
    }

    @GetMapping
    public ApiResponse<List<TeamResponse>> getMyTeams(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<TeamResponse> response = teamService.getMyTeams(userDetails.userId());
        return ApiResponse.success(response);
    }

    @GetMapping("/{teamId}")
    public ApiResponse<TeamResponse> getTeam(
            @PathVariable Long teamId) {
        TeamResponse response = teamService.getTeam(teamId);
        return ApiResponse.success(response);
    }

    @PutMapping("/{teamId}")
    public ApiResponse<TeamResponse> updateTeam(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @Valid @RequestBody TeamUpdateRequest request) {
        TeamResponse response = teamService.updateTeam(userDetails.userId(), teamId, request);
        return ApiResponse.success(response);
    }

    @GetMapping("/{teamId}/members")
    public ApiResponse<List<TeamMemberResponse>> getTeamMembers(
            @PathVariable Long teamId) {
        List<TeamMemberResponse> response = teamService.getTeamMembers(teamId);
        return ApiResponse.success(response);
    }

    @DeleteMapping("/{teamId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @PathVariable Long userId) {
        teamService.removeMember(userDetails.userId(), teamId, userId);
    }

    @DeleteMapping("/{teamId}/members/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leaveTeam(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId) {
        teamService.leaveTeam(userDetails.userId(), teamId);
    }

    @PutMapping("/{teamId}/members/{userId}/role")
    public ApiResponse<Void> changeRole(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long teamId,
            @PathVariable Long userId,
            @Valid @RequestBody ChangeRoleRequest request) {
        teamService.changeRole(userDetails.userId(), teamId, userId, request.getRole());
        return ApiResponse.success();
    }
}
