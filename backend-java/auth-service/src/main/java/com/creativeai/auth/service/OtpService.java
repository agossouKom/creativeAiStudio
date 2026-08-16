package com.creativeai.auth.service;

import com.creativeai.auth.model.Otp;
import com.creativeai.auth.repository.OtpRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpRepository otpRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String mailFrom;

    @Value("${app.otp.expiration-minutes}")
    private int expirationMinutes;

    @Transactional
    public void sendOtp(String email, String purpose) {
        String code = String.format("%06d", new Random().nextInt(1000000));
        
        Otp otp = Otp.builder()
                .email(email)
                .code(code)
                .purpose(purpose)
                .expiresAt(LocalDateTime.now().plusMinutes(expirationMinutes))
                .used(false)
                .build();
        
        otpRepository.save(otp);
        
        System.out.println(">>> OTP [ " + purpose + " ] pour " + email + " : " + code);
        
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(email);
            message.setSubject("Votre code de vérification Creative AI Studio");
            message.setText("Votre code OTP est : " + code + ". Il expire dans " + expirationMinutes + " minutes.");
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Impossible d'envoyer l'email OTP : " + e.getMessage());
        }
    }

    @Transactional
    public boolean verifyOtp(String email, String code) {
        return otpRepository.findTopByEmailAndCodeAndUsedFalseOrderByCreatedAtDesc(email, code)
                .map(otp -> {
                    if (otp.getExpiresAt().isAfter(LocalDateTime.now())) {
                        otp.setUsed(true);
                        otpRepository.save(otp);
                        return true;
                    }
                    return false;
                }).orElse(false);
    }
}
