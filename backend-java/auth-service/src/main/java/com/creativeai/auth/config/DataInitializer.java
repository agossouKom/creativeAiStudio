package com.creativeai.auth.config;

import com.creativeai.auth.model.User;
import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.Role;
import com.creativeai.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) throws Exception {
        User admin = userRepository.findByEmail(adminEmail)
                .orElse(User.builder()
                        .email(adminEmail)
                        .role(Role.ADMIN)
                        .abonnement(Abonnement.PREMIUM)
                        .credits(9999)
                        .build());

        admin.setFullName("Admin Creative AI Studio");
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setEnabled(true);

        userRepository.save(admin);
        System.out.println("Compte ADMIN synchronisé : " + adminEmail);
    }
}
