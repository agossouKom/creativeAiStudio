package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.ContactRequest;
import com.creativeai.auth.dto.response.ContactResponse;
import com.creativeai.auth.model.Contact;
import com.creativeai.auth.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ContactService {

    private final ContactRepository repo;
    private final org.springframework.mail.javamail.JavaMailSender mailSender;
    
    @org.springframework.beans.factory.annotation.Value("${spring.mail.username}")
    private String mailFrom;

    public ContactResponse create(ContactRequest req) {
        Contact c = Contact.builder()
                .nomComplet(req.nomComplet()).email(req.email())
                .sujet(req.sujet()).message(req.message()).traite(false).build();
        return toResponse(repo.save(c));
    }

    public ContactResponse reply(String id, com.creativeai.auth.dto.request.ContactReplyRequest req) {
        Contact c = getOrThrow(id);
        
        try {
            org.springframework.mail.SimpleMailMessage msg = new org.springframework.mail.SimpleMailMessage();
            msg.setFrom(mailFrom);
            msg.setTo(c.getEmail());
            msg.setSubject("RE: " + req.sujet());
            msg.setText(req.message());
            mailSender.send(msg);
            
            c.setTraite(true);
            return toResponse(repo.save(c));
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'envoi de la réponse par email : " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public ContactResponse findById(String id) { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<ContactResponse> findAll(boolean deleted) {
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    public ContactResponse restore(String id) {
        Contact c = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Contact introuvable : " + id));
        c.setDeleted(false);
        return toResponse(repo.save(c));
    }

    @Transactional(readOnly = true)
    public List<ContactResponse> findUnhandled() { return repo.findByDeletedFalseAndTraiteFalse().stream().map(this::toResponse).toList(); }

    @Transactional(readOnly = true)
    public List<ContactResponse> findHandled()   { return repo.findByDeletedFalseAndTraiteTrue().stream().map(this::toResponse).toList(); }

    public ContactResponse markAsHandled(String id) {
        Contact c = getOrThrow(id); c.setTraite(true);
        return toResponse(repo.save(c));
    }

    public void delete(String id) { Contact c = getOrThrow(id); c.setDeleted(true); repo.save(c); }

    private Contact getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Contact introuvable : " + id));
    }

    public ContactResponse toResponse(Contact c) {
        return new ContactResponse(c.getId(), c.getNomComplet(), c.getEmail(),
                c.getSujet(), c.getMessage(), c.isTraite(), c.getCreatedAt());
    }
}
