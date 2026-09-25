package com.creativeai.auth.service;

import com.creativeai.auth.model.Otp;
import com.creativeai.auth.repository.OtpRepository;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpRepository otpRepository;
    private final JavaMailSender mailSender;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${spring.mail.username}")
    private String mailFrom;

    @Value("${app.otp.expiration-minutes}")
    private int expirationMinutes;

    @Transactional
    public void sendOtp(String email, String purpose) {
        String normalizedPurpose = purpose == null ? "" : purpose;
        String code = String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
        
        Otp otp = Otp.builder()
                .email(email)
                .code(code)
                .purpose(normalizedPurpose)
                .expiresAt(LocalDateTime.now().plusMinutes(expirationMinutes))
                .used(false)
                .build();
        
        otpRepository.save(otp);
        
        try {
            String title = otpTitle(normalizedPurpose);
            String instruction = otpInstruction(normalizedPurpose);
            String plainText = buildOtpPlainText(email, code, title, instruction);
            String htmlText = buildOtpHtml(email, code, title, instruction);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(mailFrom);
            helper.setTo(email);
            helper.setSubject("Votre code de vérification Creative AI Studio");

            MimeMultipart alternative = new MimeMultipart("alternative");
            MimeBodyPart plainPart = new MimeBodyPart();
            plainPart.setText(plainText, StandardCharsets.UTF_8.name());
            alternative.addBodyPart(plainPart);

            MimeBodyPart htmlPart = new MimeBodyPart();
            htmlPart.setContent(htmlText, "text/html; charset=UTF-8");
            alternative.addBodyPart(htmlPart);
            message.setContent(alternative);
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Impossible d'envoyer l'email OTP", e);
        }
    }

    private String otpTitle(String purpose) {
        return switch (purpose) {
            case "LOGIN" -> "Votre code de connexion";
            case "REGISTRATION" -> "Votre code d'inscription";
            case "PASSWORD_RESET" -> "Votre code de réinitialisation";
            default -> "Votre code de vérification";
        };
    }

    private String otpInstruction(String purpose) {
        return switch (purpose) {
            case "REGISTRATION" -> "Utilisez le code ci-dessous pour finaliser votre inscription :";
            case "PASSWORD_RESET" -> "Utilisez le code ci-dessous pour réinitialiser votre mot de passe :";
            default -> "Utilisez le code ci-dessous pour finaliser votre connexion :";
        };
    }

    private String buildOtpPlainText(String email, String code, String title, String instruction) {
        return "Bonjour,\n\n"
                + title + "\n\n"
                + instruction + "\n\n"
                + "Votre code OTP est : " + code + ".\n\n"
                + "Ce code expirera dans " + expirationMinutes + " minutes.\n\n"
                + "Ne partagez jamais ce code avec qui que ce soit.\n\n"
                + "Compte : " + email;
    }

    private String buildOtpHtml(String email, String code, String title, String instruction) {
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH));
        return """
                <!doctype html>
                <html lang="fr">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>{{TITLE}}</title>
                </head>
                <body style="margin:0;padding:0;background:#ffffff;color:#2c2c2c;font-family:Arial,Helvetica,sans-serif;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ffffff;">
                    <tr>
                      <td align="center" style="background:#f6f6f6;padding:14px 24px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                          <tr>
                            <td width="42" style="width:42px;vertical-align:middle;">
                              <a href="https://ai.labibpro.com" style="display:block;text-decoration:none;">
                                <img src="https://ai.labibpro.com/favicon-192.png" width="42" height="42" alt="Creative AI Studio" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;">
                              </a>
                            </td>
                            <td style="padding-left:12px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;letter-spacing:.4px;color:#00236b;">
                              CREATIVE <span style="color:#1155cc;">AI</span> STUDIO
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="background:#00236b;padding:25px 24px 23px 45px;">
                        <h1 style="margin:0;color:#ffffff;font-size:17px;line-height:20px;font-weight:700;">{{TITLE}}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:35px 24px 38px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td style="font-size:10px;line-height:15px;color:#2c2c2c;">
                              <strong style="font-weight:700;">CREATIVE AI STUDIO</strong><br>
                              Service de vérification<br>
                              <a href="https://ai.labibpro.com" style="color:#1155cc;text-decoration:underline;">ai.labibpro.com</a>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:41px;font-size:10px;line-height:15px;color:#2c2c2c;">Paris, le {{DATE}}</td>
                          </tr>
                          <tr>
                            <td style="padding-top:16px;font-size:10px;line-height:13px;color:#2c2c2c;">
                              Bonjour,<br>
                              Compte : {{EMAIL}}
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:23px 0 0 21px;font-size:10.5px;line-height:16px;color:#2c2c2c;">{{INSTRUCTION}}</td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:22px 0 0 21px;">
                              <span style="display:inline-block;width:127px;min-width:127px;max-width:127px;box-sizing:border-box;padding:16px 16px 18px;background:#f0f3ff;font-size:19px;line-height:20px;font-weight:700;letter-spacing:5.6px;color:#4f46e5;">{{CODE}}</span>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:15px 0 0 21px;font-size:8.7px;line-height:16px;color:#2c2c2c;">Ce code expirera dans {{MINUTES}} minutes.</td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:12px 0 0 29px;font-size:8.7px;line-height:15px;color:#cc1800;">Ne partagez jamais ce code avec qui que ce soit.</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """
                .replace("{{TITLE}}", HtmlUtils.htmlEscape(title))
                .replace("{{INSTRUCTION}}", HtmlUtils.htmlEscape(instruction))
                .replace("{{EMAIL}}", HtmlUtils.htmlEscape(email))
                .replace("{{DATE}}", date)
                .replace("{{CODE}}", code)
                .replace("{{MINUTES}}", Integer.toString(expirationMinutes));
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
