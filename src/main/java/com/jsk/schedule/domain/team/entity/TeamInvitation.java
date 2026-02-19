package com.jsk.schedule.domain.team.entity;

import com.jsk.schedule.domain.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 팀 초대 엔티티.
 * BaseEntity를 상속하지 않음 — createdAt/respondedAt 직접 관리 (updatedAt 불필요).
 * invitee는 초대 수락 시점에 연결되므로 nullable.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "team_invitations")
public class TeamInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inviter_id", nullable = false)
    private User inviter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invitee_id")
    private User invitee;

    @Column(name = "invitee_kakao_id", nullable = false)
    private Long inviteeKakaoId;

    @Column(name = "token", nullable = false, unique = true, length = 255)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private InvitationStatus status;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @PrePersist
    protected void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = InvitationStatus.PENDING;
        }
    }

    public static TeamInvitation create(Team team, User inviter, Long inviteeKakaoId,
                                        String token, LocalDateTime expiresAt) {
        TeamInvitation invitation = new TeamInvitation();
        invitation.team = team;
        invitation.inviter = inviter;
        invitation.inviteeKakaoId = inviteeKakaoId;
        invitation.token = token;
        invitation.expiresAt = expiresAt;
        invitation.status = InvitationStatus.PENDING;
        return invitation;
    }

    /**
     * 초대 수락 — invitee 연결, 상태 변경, 응답 일시 기록
     */
    public void accept(User invitee) {
        this.status = InvitationStatus.ACCEPTED;
        this.invitee = invitee;
        this.respondedAt = LocalDateTime.now();
    }

    /**
     * 초대 거절 — 상태 변경, 응답 일시 기록
     */
    public void reject() {
        this.status = InvitationStatus.REJECTED;
        this.respondedAt = LocalDateTime.now();
    }

    /**
     * 초대 만료 처리 (스케줄러에 의해 일괄 처리 또는 조회 시점 확인)
     */
    public void expire() {
        this.status = InvitationStatus.EXPIRED;
    }

    /**
     * 만료 여부 확인 (현재 시각 기준)
     */
    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }

    /**
     * 응답 대기 상태 여부 확인
     */
    public boolean isPending() {
        return InvitationStatus.PENDING.equals(this.status);
    }
}
