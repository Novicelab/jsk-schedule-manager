package com.jsk.schedule.infra.kakao;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 카카오 API 관련 설정 프로퍼티.
 * application-dev.yml의 kakao.* 값을 바인딩한다.
 * 민감 정보는 환경변수로 주입받으며 코드에 하드코딩 금지.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "kakao")
public class KakaoApiProperties {

    /**
     * 카카오 OAuth 애플리케이션 클라이언트 ID
     */
    private String clientId;

    /**
     * 카카오 OAuth 애플리케이션 클라이언트 시크릿
     */
    private String clientSecret;

    /**
     * 카카오 OAuth 리다이렉트 URI
     */
    private String redirectUri;

    /**
     * 카카오 알림톡 발신 프로필 키 (비즈니스 채널 등록 후 발급).
     * 개발 단계에서는 나에게 보내기 API를 사용하므로 직접 사용되지 않으나 설정 구조 유지.
     */
    private String alimtalkSenderKey;
}
