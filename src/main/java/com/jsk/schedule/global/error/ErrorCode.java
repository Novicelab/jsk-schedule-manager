package com.jsk.schedule.global.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 인증/인가
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "EXPIRED_TOKEN", "만료된 토큰입니다."),
    REFRESH_TOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_NOT_FOUND", "Refresh Token을 찾을 수 없습니다."),

    // 리소스
    NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "요청한 리소스를 찾을 수 없습니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."),
    TEAM_NOT_FOUND(HttpStatus.NOT_FOUND, "TEAM_NOT_FOUND", "팀을 찾을 수 없습니다."),
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND", "일정을 찾을 수 없습니다."),
    SCHEDULE_ARCHIVED(HttpStatus.GONE, "SCHEDULE_ARCHIVED", "이미 아카이브된 일정입니다."),
    INVITATION_NOT_FOUND(HttpStatus.NOT_FOUND, "INVITATION_NOT_FOUND", "초대를 찾을 수 없습니다."),

    // 요청 오류
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "잘못된 요청입니다."),
    INVALID_DATE_RANGE(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "종료 일시는 시작 일시보다 이후여야 합니다."),
    INVITATION_EXPIRED(HttpStatus.BAD_REQUEST, "INVITATION_EXPIRED", "만료된 초대입니다."),
    INVITATION_ALREADY_RESPONDED(HttpStatus.BAD_REQUEST, "INVITATION_ALREADY_RESPONDED", "이미 응답한 초대입니다."),

    // 충돌
    CONFLICT(HttpStatus.CONFLICT, "CONFLICT", "이미 존재하는 리소스입니다."),
    ALREADY_TEAM_MEMBER(HttpStatus.CONFLICT, "ALREADY_TEAM_MEMBER", "이미 팀에 소속된 사용자입니다."),
    MAX_TEAM_EXCEEDED(HttpStatus.CONFLICT, "MAX_TEAM_EXCEEDED", "최대 소속 팀 수(10개)를 초과했습니다."),
    DUPLICATE_KAKAO_ID(HttpStatus.CONFLICT, "DUPLICATE_KAKAO_ID", "이미 가입된 카카오 계정입니다."),

    // 서버 오류
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다."),
    KAKAO_API_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "KAKAO_API_ERROR", "카카오 API 호출 중 오류가 발생했습니다."),
    NOTIFICATION_SEND_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "NOTIFICATION_SEND_FAILED", "알림 발송에 실패했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
