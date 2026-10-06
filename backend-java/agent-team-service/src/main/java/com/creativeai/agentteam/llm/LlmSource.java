package com.creativeai.agentteam.llm;

/**
 * Tier de la chaîne de résolution qui a fourni le modèle retenu.
 *
 * <p>Cette information est celle qui manque le plus quand on cherche à savoir
 * pourquoi un agent a répondu avec un certain modèle. Les attributs du provider
 * ne suffisent pas : un provider sans équipe comme sans compte, actif, peut
 * aussi bien venir d'un choix personnel que du provider par défaut de la
 * plateforme, et les deux ne se distinguent que par leur identifiant. Deviner à
 * partir de quatre champs produit régulièrement de fausses conclusions — c'est
 * en ayant mal lu une résolution que l'on a pris un provider d'agent pour un
 * repli sur la clé d'environnement.
 *
 * <p>L'ordre de ce {@code enum} est celui de la priorité : du plus spécifique
 * au plus générique.
 */
public enum LlmSource {

    /** Rattaché à l'agent lui-même. Le plus spécifique, donc le plus prioritaire. */
    AGENT,

    /** Choisi par l'utilisateur pour son équipe. */
    TEAM,

    /**
     * Déposé automatiquement sur l'équipe parce qu'elle n'en avait pas.
     * Se distingue de {@link #TEAM} car ce n'est pas un choix de l'utilisateur :
     * il passe derrière le choix de compte, et pas devant.
     */
    TEAM_AUTO,

    /** Choisi par l'utilisateur dans son compte. */
    ACCOUNT,

    /** Marqué comme modèle par défaut de la plateforme par un administrateur. */
    PLATFORM_DEFAULT,

    /** Repli sur le compte administrateur, faute de provider de plateforme marqué. */
    ADMIN,

    /** Dernier recours : la clé d'environnement du service. */
    ENVIRONMENT
}