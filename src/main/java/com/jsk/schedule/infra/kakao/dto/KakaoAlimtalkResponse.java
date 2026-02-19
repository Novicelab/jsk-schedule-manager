package com.jsk.schedule.infra.kakao.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.List;

/**
 * 카카오 나에게 보내기 API 응답 DTO.
 * 성공 시 result_code: 0 반환.
 */
@Getter
public class KakaoAlimtalkResponse {

    /**
     * 발송 결과 코드. 0이면 성공.
     */
    @JsonProperty("result_code")
    private Integer resultCode;

    /**
     * 성공한 수신자 UUID 목록 (알림톡 대량 발송 방식에서 사용).
     * 나에게 보내기 방식에서는 미사용이나 확장성 위해 유지.
     */
    @JsonProperty("successful_receiver_uuids")
    private List<String> successfulReceiverUuids;

    /**
     * 실패 상세 정보 목록
     */
    @JsonProperty("failure_info")
    private List<FailureInfo> failureInfo;

    /**
     * 발송 성공 여부 판단.
     * result_code가 0이거나 null(나에게 보내기 성공 시 바디 없음)이면 성공으로 간주.
     */
    public boolean isSuccess() {
        return resultCode == null || resultCode == 0;
    }

    @Getter
    public static class FailureInfo {

        @JsonProperty("code")
        private Integer code;

        @JsonProperty("msg")
        private String msg;

        @JsonProperty("receiver_uuids")
        private List<String> receiverUuids;
    }
}
