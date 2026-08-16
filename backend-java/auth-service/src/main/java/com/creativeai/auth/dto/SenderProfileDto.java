package com.creativeai.auth.dto;

public record SenderProfileDto(
    String id,
    String prenom, String nom, String poste, String departement,
    String societe, String secteur, String siteWeb, String adresse,
    String email, String telephone, String telephoneFixe, String linkedin,
    String signature, String tonEmail, String langue, String devise,
    String contexteSup
) {}
