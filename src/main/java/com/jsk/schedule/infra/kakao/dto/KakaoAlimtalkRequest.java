package com.jsk.schedule.infra.kakao.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 카카오 나에게 보내기 API 요청 DTO.
 * 실제 알림톡(비즈니스 채널) 대신 개발 단계에서는 나에게 보내기 방식으로 단순화.
 * POST https://kapi.kakao.com/v2/api/talk/memo/default/send
 */
@Getter
@RequiredArgsConstructor
public class KakaoAlimtalkRequest {

    /**
     * 발송할 메시지 내용 (text 타입 템플릿)
     */
    private final String text;

    /**
     * 링크 정보 — 나에게 보내기 API 필수 파라미터 (빈 값 허용)
     */
    private final String link;
}
