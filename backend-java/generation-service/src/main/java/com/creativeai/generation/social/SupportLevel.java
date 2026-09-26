package com.creativeai.generation.social;

/**
 * Niveau de couverture réel d'une plateforme dans cette installation.
 */
public enum SupportLevel {
    /** Adaptateur branché : la publication part vers l'API de la plateforme. */
    LIVE,
    /** Plateforme prévue mais sans adaptateur : la demande est refusée, jamais simulée. */
    PLANNED
}
