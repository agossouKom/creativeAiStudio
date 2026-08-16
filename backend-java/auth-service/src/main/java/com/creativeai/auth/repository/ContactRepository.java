package com.creativeai.auth.repository;

import com.creativeai.auth.model.Contact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContactRepository extends JpaRepository<Contact, String> {
    List<Contact> findByDeletedFalse();
    List<Contact> findByDeletedFalseAndTraiteFalse();  // unhandled
    List<Contact> findByDeletedFalseAndTraiteTrue();   // handled
    List<Contact> findByDeletedTrue();
}
