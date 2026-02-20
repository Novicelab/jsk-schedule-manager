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
@Profile("local")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        log.info("Initializing test data...");

        String encodedPassword = passwordEncoder.encode("1234");
        log.debug("Encoded password for '1234': {} (length: {})",
                encodedPassword.substring(0, Math.min(20, encodedPassword.length())) + "...",
                encodedPassword.length());

        // 1. admin 계정 (USER 역할)
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.ofCredential("admin", encodedPassword, "관리자");
            admin = userRepository.save(admin);
            log.info("Created test account - admin: {}", admin.getId());
        } else {
            log.info("Test account 'admin' already exists - skipping creation");
        }

        // 2. siljang 계정 (USER 역할)
        if (!userRepository.existsByUsername("siljang")) {
            User siljang = User.ofCredential("siljang", encodedPassword, "실장");
            siljang = userRepository.save(siljang);
            log.info("Created test account - siljang: {}", siljang.getId());
        } else {
            log.info("Test account 'siljang' already exists");
        }

        // 3. user 계정 (USER 역할)
        if (!userRepository.existsByUsername("user")) {
            User user = User.ofCredential("user", encodedPassword, "사용자");
            user = userRepository.save(user);
            log.info("Created test account - user: {}", user.getId());
        } else {
            log.info("Test account 'user' already exists");
        }

        log.info("Test data initialization completed");
    }
}
