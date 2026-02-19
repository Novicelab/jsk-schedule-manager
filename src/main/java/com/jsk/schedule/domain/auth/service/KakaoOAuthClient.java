package com.jsk.schedule.domain.auth.service;

import com.jsk.schedule.domain.auth.dto.KakaoTokenResponse;
import com.jsk.schedule.domain.auth.dto.KakaoUserInfo;
import com.jsk.schedule.global.error.BusinessException;
import com.jsk.schedule.global.error.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 카카오 OAuth API 클라이언트.
 * Authorization Code → Kakao Access Token 교환 및 사용자 정보 조회를 담당한다.
 */
@Slf4j
@Component
public class KakaoOAuthClient {

    private static final String KAKAO_AUTH_BASE_URL = "https://kauth.kakao.com";
    private static final String KAKAO_API_BASE_URL = "https://kapi.kakao.com";
    private static final String GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";

    private final WebClient kakaoAuthWebClient;
    private final WebClient kakaoApiWebClient;

    @Value("${kakao.client-id}")
    private String clientId;

    @Value("${kakao.client-secret}")
    private String clientSecret;

    @Value("${kakao.redirect-uri}")
    private String redirectUri;

    public KakaoOAuthClient() {
        this.kakaoAuthWebClient = WebClient.builder()
                .baseUrl(KAKAO_AUTH_BASE_URL)
                .build();
        this.kakaoApiWebClient = WebClient.builder()
                .baseUrl(KAKAO_API_BASE_URL)
                .build();
    }

    /**
     * Authorization Code를 카카오 Access Token으로 교환한다.
     *
     * @param code 카카오 인증 서버로부터 받은 Authorization Code
     * @return KakaoTokenResponse (access_token, refresh_token 포함)
     */
    public KakaoTokenResponse getKakaoToken(String code) {
        log.debug("카카오 토큰 발급 요청: code={}", code);
        try {
            return kakaoAuthWebClient.post()
                    .uri("/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData("grant_type", GRANT_TYPE_AUTHORIZATION_CODE)
                            .with("client_id", clientId)
                            .with("client_secret", clientSecret)
                            .with("redirect_uri", redirectUri)
                            .with("code", code))
                    .retrieve()
                    .bodyToMono(KakaoTokenResponse.class)
                    .block();
        } catch (WebClientResponseException e) {
            log.error("카카오 토큰 발급 API 오류: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        } catch (Exception e) {
            log.error("카카오 토큰 발급 중 예기치 못한 오류 발생", e);
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        }
    }

    /**
     * 카카오 Access Token으로 사용자 정보를 조회한다.
     *
     * @param kakaoAccessToken 카카오 Access Token
     * @return KakaoUserInfo (kakaoId, email, nickname, profileImageUrl 포함)
     */
    public KakaoUserInfo getKakaoUserInfo(String kakaoAccessToken) {
        log.debug("카카오 사용자 정보 조회 요청");
        try {
            return kakaoApiWebClient.get()
                    .uri("/v2/user/me")
                    .header("Authorization", "Bearer " + kakaoAccessToken)
                    .retrieve()
                    .bodyToMono(KakaoUserInfo.class)
                    .block();
        } catch (WebClientResponseException e) {
            log.error("카카오 사용자 정보 조회 API 오류: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        } catch (Exception e) {
            log.error("카카오 사용자 정보 조회 중 예기치 못한 오류 발생", e);
            throw new BusinessException(ErrorCode.KAKAO_API_ERROR);
        }
    }
}
