package com.jsk.schedule.infra.kakao;

import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import com.jsk.schedule.infra.kakao.dto.KakaoAlimtalkResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 카카오 알림 API 클라이언트.
 * 개발 단계에서는 비즈니스 채널 등록 없이 사용 가능한 '나에게 보내기 API'로 구현.
 * POST https://kapi.kakao.com/v2/api/talk/memo/default/send
 *
 * 운영 전환 시: 알림톡 API (POST /v1/api/talk/template/send) 로 교체 필요.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoApiClient {

    private static final String KAKAO_API_BASE_URL = "https://kapi.kakao.com";
    private static final String MEMO_SEND_URI = "/v2/api/talk/memo/default/send";

    /**
     * 나에게 보내기 API에서 요구하는 text 타입 템플릿 JSON 형식.
     * link는 필수이므로 빈 객체로 전달한다.
     */
    private static final String TEXT_TEMPLATE_FORMAT =
            "{\"object_type\":\"text\",\"text\":\"%s\",\"link\":{\"web_url\":\"\",\"mobile_web_url\":\"\"}}";

    // WebConfig에서 빈으로 등록된 WebClient를 DI 받는다 (테스트 시 Mock 교체 가능)
    private final WebClient webClient;

    private WebClient kakaoApiWebClient() {
        return webClient.mutate()
                .baseUrl(KAKAO_API_BASE_URL)
                .build();
    }

    /**
     * 카카오 나에게 보내기 API로 메시지를 발송한다.
     *
     * @param kakaoAccessToken 수신자의 카카오 Access Token (User 엔티티에 저장된 값)
     * @param message          발송할 메시지 내용
     * @return KakaoAlimtalkResponse
     * @throws BusinessException 카카오 API 호출 실패 시
     */
    public KakaoAlimtalkResponse sendAlimtalk(String kakaoAccessToken, String message) {
        log.debug("카카오 나에게 보내기 API 호출 시작");

        // 메시지 내 특수문자 이스케이프 처리 (XSS 방지 및 JSON 파싱 오류 방지)
        String escapedMessage = escapeJsonString(message);
        String templateJson = String.format(TEXT_TEMPLATE_FORMAT, escapedMessage);

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("template_object", templateJson);

        try {
            KakaoAlimtalkResponse response = kakaoApiWebClient().post()
                    .uri(MEMO_SEND_URI)
                    .header("Authorization", "Bearer " + kakaoAccessToken)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .bodyToMono(KakaoAlimtalkResponse.class)
                    // 나에게 보내기 API는 성공 시 빈 바디 + 200 반환하는 경우가 있으므로 null 허용
                    .defaultIfEmpty(new KakaoAlimtalkResponse())
                    .block();

            log.debug("카카오 나에게 보내기 API 응답 수신 완료");
            return response;

        } catch (WebClientResponseException e) {
            log.error("카카오 알림 API 오류: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("카카오 알림 API 호출 중 예기치 못한 오류 발생", e);
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        }
    }

    /**
     * JSON 문자열 내 특수문자를 이스케이프 처리한다.
     * 따옴표, 역슬래시, 개행문자 등을 안전하게 변환.
     */
    private String escapeJsonString(String input) {
        if (input == null) {
            return "";
        }
        return input
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
