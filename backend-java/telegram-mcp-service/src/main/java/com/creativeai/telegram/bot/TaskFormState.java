package com.creativeai.telegram.bot;

import java.util.List;
import java.util.Set;

/**
 * Etat du wizard de création de tâche (formulaire USSD Telegram).
 * Reproduit exactement les champs du formulaire frontend CreativeAI Studio.
 */
public record TaskFormState(
    Step         step,
    String       title,
    String       type,
    String       priority,
    String       description,
    List<String> contacts,
    List<String> productCodes,
    String       dueDate,
    String       scheduledAt,
    Boolean      confidential,
    String       expectedResult,
    String       aiGeneratedDesc
) {

    // ── Étapes du wizard ──────────────────────────────────────────────────────

    public enum Step {
        AWAITING_TITLE,
        AWAITING_TYPE,
        AWAITING_PRIORITY,
        AWAITING_DESCRIPTION,
        AWAITING_AI_CONFIRM,
        AWAITING_CONTACTS,
        AWAITING_PRODUCTS,
        AWAITING_DUE_DATE,
        AWAITING_EXECUTION,
        AWAITING_SCHEDULED_AT,
        AWAITING_CONFIDENTIAL,
        AWAITING_EXPECTED_RESULT
    }

    // ── Constructeurs de progression ──────────────────────────────────────────

    public static TaskFormState initial() {
        return new TaskFormState(Step.AWAITING_TITLE, null, null, null, null,
                                 List.of(), List.of(), null, null, null, null, null);
    }

    public TaskFormState withTitle(String t) {
        return new TaskFormState(Step.AWAITING_TYPE, t, type, priority, description,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withType(String t) {
        return new TaskFormState(Step.AWAITING_PRIORITY, title, t, priority, description,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withPriority(String p) {
        return new TaskFormState(Step.AWAITING_DESCRIPTION, title, type, p, description,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withDescription(String d) {
        Step next = requiresContacts(type) ? Step.AWAITING_CONTACTS : Step.AWAITING_PRODUCTS;
        return new TaskFormState(next, title, type, priority, d,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState pendingAiDesc(String generated) {
        return new TaskFormState(Step.AWAITING_AI_CONFIRM, title, type, priority, null,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, generated);
    }

    public TaskFormState withContacts(List<String> c) {
        return new TaskFormState(Step.AWAITING_PRODUCTS, title, type, priority, description,
                                 c, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withProducts(List<String> p) {
        return new TaskFormState(Step.AWAITING_DUE_DATE, title, type, priority, description,
                                 contacts, p, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState skipProducts() {
        return new TaskFormState(Step.AWAITING_DUE_DATE, title, type, priority, description,
                                 contacts, List.of(), dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState awaitingProductSelection(List<String> current) {
        return new TaskFormState(Step.AWAITING_PRODUCTS, title, type, priority, description,
                                 contacts, current, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withDueDate(String d) {
        return new TaskFormState(Step.AWAITING_EXECUTION, title, type, priority, description,
                                 contacts, productCodes, d, scheduledAt, confidential, expectedResult, null);
    }

    public TaskFormState withScheduledAt(String s) {
        return new TaskFormState(Step.AWAITING_CONFIDENTIAL, title, type, priority, description,
                                 contacts, productCodes, dueDate, s, confidential, expectedResult, null);
    }

    public TaskFormState withConfidential(Boolean c) {
        return new TaskFormState(Step.AWAITING_EXPECTED_RESULT, title, type, priority, description,
                                 contacts, productCodes, dueDate, scheduledAt, c, expectedResult, null);
    }

    public TaskFormState skipScheduled() {
        return new TaskFormState(Step.AWAITING_CONFIDENTIAL, title, type, priority, description,
                                 contacts, productCodes, dueDate, null, confidential, expectedResult, null);
    }

    public TaskFormState pendingScheduled() {
        return new TaskFormState(Step.AWAITING_SCHEDULED_AT, title, type, priority, description,
                                 contacts, productCodes, dueDate, scheduledAt, confidential, expectedResult, null);
    }

    // ── Référentiels ──────────────────────────────────────────────────────────

    public static final String[][] TASK_TYPES = {
        { "GENERAL",             "⚙️  Tâche générale"                },
        { "CONTENT_GENERATE",    "✍️  Génération de contenu"         },
        { "DOCUMENT_SUMMARIZE",  "📄  Résumé de document"            },
        { "EMAIL_RESPONSE",      "✉️  Réponse / rédaction email"     },
        { "MARKETING",           "📣  Campagne Marketing"            },
        { "PROSPECTION",         "🔍  Prospection commerciale"       },
        { "CAMPAIGN_CREATE",     "📢  Création de campagne"          },
        { "PROSPECT_SEARCH",     "🎯  Recherche de prospects"        },
        { "REPORT_GENERATE",     "📊  Génération de rapport"         },
        { "PRESENTATION_CREATE", "🖼️  Présentation / Slides"         },
        { "DOCUMENT_PDF",        "🖨️  Document PDF"                  },
        { "ACCOUNTING_REPORT",   "🧾  Rapport comptable"             },
        { "CV_CREATE",           "📋  Création de CV"                },
        { "SOCIAL_CONTENT",      "📱  Contenu réseaux sociaux"       },
        { "IMAGE_CREATE",        "🎨  Création d'image"              },
        { "VIDEO_CREATE",        "🎬  Création de vidéo"             },
        { "FLYER_CREATE",        "🗞️  Flyer / Affiche"               },
        { "SECURITY_AUDIT",      "🔒  Audit sécurité"                },
        { "CUSTOMER_SUPPORT",    "💬  Support client"                },
        { "ACCOUNTING",          "💰  Comptabilité"                  },
        { "SCRUM",               "📌  Gestion de projet Scrum"       }
    };

    public static final String[][] PRIORITIES = {
        { "LOW",      "🟢  Basse"    },
        { "MEDIUM",   "🟡  Normale"  },
        { "HIGH",     "🟠  Haute"    },
        { "URGENT",   "🔴  Urgente"  },
        { "CRITICAL", "🚨  Critique" }
    };

    private static final Set<String> CONTACT_TYPES = Set.of(
        "MARKETING", "PROSPECTION", "EMAIL_RESPONSE", "SOCIAL_CONTENT",
        "CAMPAIGN_CREATE", "PROSPECT_SEARCH"
    );

    private static final Set<String> PRODUCT_TYPES = Set.of(
        "MARKETING", "SOCIAL_CONTENT", "PRESENTATION_CREATE", "PROSPECTION",
        "CAMPAIGN_CREATE", "IMAGE_CREATE", "VIDEO_CREATE", "FLYER_CREATE"
    );

    public static boolean requiresContacts(String type) {
        return type != null && CONTACT_TYPES.contains(type);
    }

    public static boolean suggestsProducts(String type) {
        return type != null && PRODUCT_TYPES.contains(type);
    }

    public static String typeByIndex(int i) {
        return (i >= 1 && i <= TASK_TYPES.length) ? TASK_TYPES[i - 1][0] : null;
    }

    public static String priorityByIndex(int i) {
        return (i >= 1 && i <= PRIORITIES.length) ? PRIORITIES[i - 1][0] : null;
    }

    /** Suggestions de résultats attendus selon le type de tâche. */
    public static String[] resultSuggestions(String type) {
        if (type == null) return new String[]{"Obtenir un livrable de qualité"};
        return switch (type) {
            case "EMAIL_RESPONSE","EMAIL_CLASSIFICATION"  -> new String[]{"Répondre aux emails urgents", "Trier et classer les emails", "Relancer les contacts inactifs"};
            case "PROSPECT_SEARCH","PROSPECT_QUALIFY"     -> new String[]{"Trouver 50 prospects qualifiés", "Constituer une liste de leads", "Identifier des clients potentiels"};
            case "PROSPECT_OUTREACH"                      -> new String[]{"Convertir les prospects en acheteurs", "Générer des rendez-vous commerciaux", "Augmenter le taux de conversion"};
            case "CAMPAIGN_CREATE"                        -> new String[]{"Lancer une campagne email", "Augmenter les ventes", "Inviter les contacts VIP", "Relancer les clients inactifs"};
            case "CONTENT_GENERATE","SOCIAL_CONTENT"      -> new String[]{"Créer du contenu marketing", "Rédiger un article de blog", "Produire des posts engageants"};
            case "SOCIAL_POST"                            -> new String[]{"Publier sur les réseaux sociaux", "Augmenter l'engagement", "Promouvoir un produit"};
            case "REPORT_GENERATE"                        -> new String[]{"Générer un rapport mensuel", "Analyser les KPIs", "Tableau de bord exécutif"};
            case "DOCUMENT_SUMMARIZE"                     -> new String[]{"Résumé exécutif du document", "Points clés extraits", "Synthèse actionnable"};
            case "PRESENTATION_CREATE"                    -> new String[]{"Présentation client prête", "Deck commercial finalisé", "Support de réunion"};
            default                                       -> new String[]{"Obtenir un livrable de qualité", "Tâche accomplie dans les délais"};
        };
    }
}
