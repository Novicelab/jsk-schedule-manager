package com.jsk.schedule.global.config;

import com.jsk.schedule.domain.user.entity.Role;
import com.jsk.schedule.domain.user.entity.User;
import com.jsk.schedule.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 로컬 환경에서 테스트 계정을 자동으로 생성하는 초기화 클래스
 */
@Slf4j
@Component
@Profile({"local", "prod"})
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        log.info("Initializing test data...");

        // 기존 계정 삭제
        String[] existingUsernames = {"admin", "siljang", "user"};
        for (String username : existingUsernames) {
            userRepository.findByUsername(username).ifPresent(user -> {
                userRepository.delete(user);
                log.info("Deleted test account - {}: {}", username, user.getId());
            });
        }

        String encodedPassword = passwordEncoder.encode("1234");
        log.debug("Encoded password for '1234': {} (length: {})",
                encodedPassword.substring(0, Math.min(20, encodedPassword.length())) + "...",
                encodedPassword.length());

        // 신규 test 계정 생성 (id: test, pw: 1234)
        if (!userRepository.existsByUsername("test")) {
            User testUser = User.ofCredential("test", encodedPassword, "테스트 사용자");
            testUser = userRepository.save(testUser);
            log.info("Created test account - test: {}", testUser.getId());
        } else {
            log.info("Test account 'test' already exists - skipping creation");
        }

        log.info("Test data initialization completed");
    }
}
