package com.creativeai.generation.social;

/**
 * Comment le média doit être transmis à la plateforme.
 */
public enum MediaReference {
    /**
     * La plateforme récupère le média elle-même sur Internet : il faut une URL signée
     * (Instagram, TikTok, Pinterest, Snapchat).
     */
    PRESIGNED_URL,
    /**
     * Le service appelant sait télécharger l'objet avec ses credentials MinIO puis
     * envoyer les octets : une URL MinIO simple, sans signature, suffit (Facebook).
     */
    MINIO_URL,
    /**
     * L'API de la plateforme accepte un upload direct en octets (YouTube, X, LinkedIn).
     */
    BYTES_UPLOAD
}
