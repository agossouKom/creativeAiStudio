package com.creativeai.telegram.bot;

import com.creativeai.telegram.client.AgentTeamClient;
import com.creativeai.telegram.config.AppProperties;
import com.creativeai.telegram.tools.UserContextHolder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reçoit chaque update Telegram et dispatche selon le type :
 *  - callback_query : clics sur les boutons inline (wizard tâche)
 *  - message        : texte libre, fichiers, commandes
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UpdateDispatcher {

    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}");
    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final TelegramSender   sender;
    private final UserSessionStore sessionStore;
    private final ChatClient       chatClient;
    private final ChatModel        chatModel;
    private final AgentTeamClient  agentTeamClient;
    private final ObjectMapper     objectMapper;
    private final AppProperties    props;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    private final ConcurrentHashMap<Long, Boolean>       awaitingEmail = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, TaskFormState> taskForms     = new ConcurrentHashMap<>();

    // ── Dispatch principal ────────────────────────────────────────────────────

    public void dispatch(JsonNode update) {
        // Callback query = clic sur un bouton inline
        JsonNode callback = update.path("callback_query");
        if (!callback.isMissingNode()) {
            handleCallback(callback);
            return;
        }

        JsonNode message = update.path("message");
        if (message.isMissingNode()) message = update.path("edited_message");
        if (message.isMissingNode()) return;

        long   chatId    = message.path("chat").path("id").asLong();
        String firstName = message.path("from").path("first_name").asText("utilisateur");

        String textRaw = message.path("text").asText("").trim();
        if (textRaw.equalsIgnoreCase("/annuler") || textRaw.equalsIgnoreCase("/cancel")) {
            awaitingEmail.remove(chatId);
            taskForms.remove(chatId);
            sender.sendMessage(chatId, "❌ Opération annulée.");
            return;
        }

        // Formulaire tâche : fichier envoyé (import contacts CSV)
        if (taskForms.containsKey(chatId)) {
            JsonNode doc = message.path("document");
            if (!doc.isMissingNode()) {
                handleContactFileUpload(chatId, doc);
                return;
            }
        }

        String text = textRaw;
        if (text.isBlank()) return;

        log.info("[DISPATCH] chatId={} text={}", chatId,
                 text.length() > 60 ? text.substring(0, 60) + "…" : text);

        if (awaitingEmail.containsKey(chatId) && !text.startsWith("/")) {
            handleEmailInput(chatId, text);
            return;
        }

        if (taskForms.containsKey(chatId) && !text.startsWith("/")) {
            handleTaskFormInput(chatId, text);
            return;
        }

        if (text.startsWith("/")) {
            handleCommand(chatId, firstName, text);
        } else {
            handleAiMessage(chatId, text);
        }
    }

    // ── Callback query (boutons inline) ───────────────────────────────────────

    private void handleCallback(JsonNode callback) {
        String callbackId = callback.path("id").asText();
        long   chatId     = callback.path("message").path("chat").path("id").asLong();
        String data       = callback.path("data").asText("");

        sender.answerCallback(callbackId);

        if (data.startsWith("task:")) {
            handleTaskCallback(chatId, data.substring(5));
        }
    }

    private void handleTaskCallback(long chatId, String data) {
        TaskFormState state = taskForms.get(chatId);
        if (state == null) return;

        int sep = data.indexOf(':');
        if (sep < 0) return;
        String action = data.substring(0, sep);
        String value  = data.substring(sep + 1);

        switch (action) {

            case "type" -> {
                if (state.step() != TaskFormState.Step.AWAITING_TYPE) return;
                taskForms.put(chatId, state.withType(value));
                sendPriorityKeyboard(chatId);
            }

            case "priority" -> {
                if (state.step() != TaskFormState.Step.AWAITING_PRIORITY) return;
                taskForms.put(chatId, state.withPriority(value));
                sendDescriptionPrompt(chatId);
            }

            case "desc" -> {
                if ("ai".equals(value)) {
                    if (state.step() != TaskFormState.Step.AWAITING_DESCRIPTION) return;
                    generateAiDescription(chatId, state);
                } else if ("confirm".equals(value)) {
                    if (state.step() != TaskFormState.Step.AWAITING_AI_CONFIRM) return;
                    TaskFormState confirmed = state.withDescription(state.aiGeneratedDesc());
                    taskForms.put(chatId, confirmed);
                    sendNextAfterDescription(chatId, confirmed);
                } else if ("edit".equals(value)) {
                    if (state.step() != TaskFormState.Step.AWAITING_AI_CONFIRM) return;
                    taskForms.put(chatId, state.withPriority(state.priority()));
                    sendDescriptionPrompt(chatId);
                }
            }

            case "clients" -> {
                if ("pick".equals(value)) {
                    sendClientPickerMenu(chatId);
                } else if ("confirm".equals(value)) {
                    TaskFormState s = taskForms.get(chatId);
                    if (s == null) return;
                    sender.sendMessage(chatId, "✅ " + s.contacts().size() + " contact(s) sélectionné(s).");
                    sendProductsQuestion(chatId);
                }
            }

            case "client" -> {
                // task:client:add:CODE
                String[] p = value.split(":", 2);
                if (p.length == 2 && "add".equals(p[0])) {
                    String code = p[1];
                    TaskFormState s = taskForms.get(chatId);
                    if (s == null) return;
                    UserSession session = sessionStore.find(chatId).orElse(null);
                    if (session == null) return;
                    try {
                        String json = agentTeamClient.fetchClients(session.jwtToken());
                        com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(json);
                        String email = null;
                        for (com.fasterxml.jackson.databind.JsonNode c : arr) {
                            if (code.equals(c.path("code").asText())) { email = c.path("email").asText(); break; }
                        }
                        if (email != null && !email.isBlank()) {
                            List<String> updated = new ArrayList<>(s.contacts());
                            if (!updated.contains(email)) updated.add(email);
                            taskForms.put(chatId, s.withContacts(updated));
                            sender.sendMessage(chatId, "✅ Ajouté : " + email + "\n_Total : " + updated.size() + " contact(s). Cliquez *Valider la sélection* ou ajoutez-en d'autres._");
                        }
                    } catch (Exception e) {
                        sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
                    }
                }
            }

            case "products" -> {
                if ("pick".equals(value)) {
                    sendProductPickerMenu(chatId);
                } else if ("confirm".equals(value)) {
                    TaskFormState s = taskForms.get(chatId);
                    if (s == null) return;
                    taskForms.put(chatId, s.withProducts(s.productCodes() != null ? s.productCodes() : List.of()));
                    sender.sendMessage(chatId, "✅ " + (s.productCodes() != null ? s.productCodes().size() : 0) + " produit(s) sélectionné(s).");
                    sendDueDatePrompt(chatId);
                }
            }

            case "product" -> {
                // task:product:toggle:CODE
                String[] p = value.split(":", 2);
                if (p.length == 2 && "toggle".equals(p[0])) {
                    String code = p[1];
                    TaskFormState s = taskForms.get(chatId);
                    if (s == null) return;
                    List<String> current = new ArrayList<>(s.productCodes() != null ? s.productCodes() : List.of());
                    if (current.contains(code)) current.remove(code); else current.add(code);
                    taskForms.put(chatId, s.awaitingProductSelection(current));
                    sender.sendMessage(chatId, "📦 " + current.size() + " produit(s) coché(s). Continuez ou cliquez *Valider*.");
                }
            }

            case "skip" -> {
                if ("contacts".equals(value)) {
                    if (state.step() != TaskFormState.Step.AWAITING_CONTACTS) return;
                    taskForms.put(chatId, state.withContacts(List.of()));
                    sendProductsQuestion(chatId);
                } else if ("products".equals(value)) {
                    taskForms.put(chatId, state.skipProducts());
                    sendDueDatePrompt(chatId);
                } else if ("duedate".equals(value)) {
                    if (state.step() != TaskFormState.Step.AWAITING_DUE_DATE) return;
                    taskForms.put(chatId, state.withDueDate(null));
                    sendExecutionKeyboard(chatId);
                }
            }

            case "exec" -> {
                if (state.step() != TaskFormState.Step.AWAITING_EXECUTION) return;
                switch (value) {
                    case "immediate" -> {
                        taskForms.put(chatId, state.skipScheduled());
                        sendConfidentialKeyboard(chatId);
                    }
                    case "scheduled" -> {
                        taskForms.put(chatId, state.pendingScheduled());
                        sender.sendMessage(chatId,
                            "📅 *Date de début planifiée*\n\n" +
                            "Format : `jj/MM/aaaa HH:mm`\n_(ex: 15/07/2026 09:00)_"
                        );
                    }
                    default -> {}
                }
            }

            case "conf" -> {
                if (state.step() != TaskFormState.Step.AWAITING_CONFIDENTIAL) return;
                boolean confidential = "private".equals(value);
                TaskFormState updated = state.withConfidential(confidential);
                taskForms.put(chatId, updated);
                sendExpectedResultKeyboard(chatId, updated.type());
            }

            case "result" -> {
                if (state.step() != TaskFormState.Step.AWAITING_EXPECTED_RESULT) return;
                if ("custom".equals(value)) {
                    sender.sendMessage(chatId,
                        "✏️ *Résultat attendu*\n\nDécrivez librement ce que vous souhaitez obtenir :"
                    );
                } else {
                    try {
                        int idx = Integer.parseInt(value);
                        String[] suggestions = TaskFormState.resultSuggestions(state.type());
                        if (idx >= 0 && idx < suggestions.length) {
                            TaskFormState finalState = taskForms.remove(chatId);
                            submitTask(chatId, finalState != null ? finalState : state, suggestions[idx]);
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }

            default -> {}
        }
    }

    // ── Commandes ─────────────────────────────────────────────────────────────

    private void handleCommand(long chatId, String firstName, String text) {
        String[] parts = text.split("\\s+", 3);
        String   cmd   = parts[0].toLowerCase();
        String   arg1  = parts.length > 1 ? parts[1].trim() : "";
        String   arg2  = parts.length > 2 ? parts[2].trim() : "";

        switch (cmd) {
            case "/start"  -> handleStart(chatId, firstName);
            case "/link"   -> startLinkFlow(chatId);
            case "/unlink" -> handleUnlink(chatId);
            case "/clear"  -> handleClear(chatId);
            case "/menu",
                 "/help"   -> handleMenu(chatId);

            case "/newtask" -> startTaskForm(chatId);

            case "/task" -> {
                if (arg1.isBlank()) startTaskForm(chatId);
                else handleTaskDetail(chatId, arg1);
            }
            case "/tasks"  -> handleTasksList(chatId, arg1);
            case "/agents" -> handleAgentsList(chatId);
            case "/agent"  -> {
                if (arg1.isBlank()) sender.sendMessage(chatId, "Usage : /agent <code>");
                else handleAgentDetail(chatId, arg1);
            }
            case "/chat"   -> {
                if (arg1.isBlank() || arg2.isBlank())
                    sender.sendMessage(chatId, "Usage : /chat <code> <message>");
                else handleChatWithAgent(chatId, arg1, arg2);
            }
            default        -> handleAiMessage(chatId, text);
        }
    }

    private void handleStart(long chatId, String firstName) {
        if (sessionStore.isLinked(chatId)) {
            UserSession s = sessionStore.find(chatId).get();
            sender.sendMessage(chatId,
                "👋 Bonjour *" + firstName + "* !\n\n" +
                "Compte lié : `" + maskEmail(s.userId()) + "`\n" +
                "Tapez /task pour créer une tâche ou /menu pour l'aide."
            );
        } else {
            sender.sendMessage(chatId,
                "👋 Bonjour *" + firstName + "* !\n\n" +
                "Bienvenue sur *CreativeAI Studio*.\n" +
                "Tapez /link pour connecter votre compte."
            );
        }
    }

    // ── Wizard liaison compte ─────────────────────────────────────────────────

    private void startLinkFlow(long chatId) {
        awaitingEmail.put(chatId, Boolean.TRUE);
        sender.sendMessage(chatId,
            "📧 *Liaison de compte*\n\n" +
            "Entrez votre adresse email CreativeAI Studio :\n\n" +
            "_(/annuler pour quitter)_"
        );
    }

    private void handleEmailInput(long chatId, String input) {
        if (!input.contains("@") || !input.contains(".")) {
            sender.sendMessage(chatId, "⚠️ Adresse email invalide. Réessayez ou tapez /annuler.");
            return;
        }
        String email = input.trim().toLowerCase();
        sender.sendMessage(chatId, "⏳ Vérification du compte…");
        if (!agentTeamClient.checkEmailExists(email)) {
            sender.sendMessage(chatId,
                "❌ Aucun compte trouvé pour `" + email + "`.\n\n" +
                "Vérifiez l'adresse ou inscrivez-vous sur la plateforme CreativeAI Studio, puis réessayez."
            );
            return;
        }
        awaitingEmail.remove(chatId);
        sessionStore.link(chatId, email);
        sender.sendMessage(chatId,
            "✅ *Compte lié !*\n\nEmail : `" + email + "`\n\n" +
            "Tapez /task pour créer une tâche ou /menu pour l'aide."
        );
    }

    // ── Wizard création de tâche ──────────────────────────────────────────────

    private void startTaskForm(long chatId) {
        if (!sessionStore.isLinked(chatId)) {
            sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link pour commencer.");
            return;
        }
        taskForms.put(chatId, TaskFormState.initial());
        sender.sendMessage(chatId,
            "📋 *Nouvelle tâche*\n\n" +
            "*Titre de la tâche :*\n_(ex: Envoyer un email aux contacts VIP)_\n\n" +
            "_/annuler pour quitter_"
        );
    }

    private void handleTaskFormInput(long chatId, String text) {
        TaskFormState state = taskForms.get(chatId);
        if (state == null) return;

        switch (state.step()) {

            case AWAITING_TITLE -> {
                if (text.length() < 3) {
                    sender.sendMessage(chatId, "⚠️ Titre trop court (3 caractères min), réessayez :");
                    return;
                }
                taskForms.put(chatId, state.withTitle(text));
                sendTypeKeyboard(chatId);
            }

            // Ces étapes sont pilotées par des boutons — rappel si l'utilisateur tape du texte
            case AWAITING_TYPE ->
                sender.sendMessage(chatId, "👆 Utilisez les boutons ci-dessus pour choisir le type de tâche.");

            case AWAITING_PRIORITY ->
                sender.sendMessage(chatId, "👆 Utilisez les boutons ci-dessus pour choisir la priorité.");

            case AWAITING_DESCRIPTION -> {
                // Texte tapé directement → utiliser comme description
                if (text.equalsIgnoreCase("ia") || text.equalsIgnoreCase("ai")) {
                    generateAiDescription(chatId, state);
                } else {
                    TaskFormState next = state.withDescription(text);
                    taskForms.put(chatId, next);
                    sendNextAfterDescription(chatId, next);
                }
            }

            case AWAITING_AI_CONFIRM ->
                sender.sendMessage(chatId, "👆 Cliquez *Confirmer* ou *Modifier* via les boutons.");

            case AWAITING_CONTACTS -> {
                List<String> emails = extractEmails(text);
                if (emails.isEmpty()) {
                    sender.sendMessage(chatId,
                        "⚠️ Aucun email valide détecté.\n\n" +
                        "Saisissez les emails séparés par des virgules, importez un fichier CSV,\n" +
                        "ou appuyez sur *Ignorer les contacts* ou *Mes clients*."
                    );
                    return;
                }
                TaskFormState next = state.withContacts(emails);
                taskForms.put(chatId, next);
                sender.sendMessage(chatId,
                    "✅ *" + emails.size() + " contact(s) ajouté(s).*\n" +
                    String.join(", ", emails.subList(0, Math.min(3, emails.size()))) +
                    (emails.size() > 3 ? " …" : "")
                );
                sendProductsQuestion(chatId);
            }

            case AWAITING_PRODUCTS ->
                sender.sendMessage(chatId, "👆 Utilisez les boutons pour gérer les produits.");

            case AWAITING_DUE_DATE -> {
                String iso = parseDate(text);
                if (iso == null) {
                    sender.sendMessage(chatId,
                        "⚠️ Format attendu : `jj/MM/aaaa HH:mm` _(ex: 30/06/2026 17:00)_\n" +
                        "Ou appuyez sur *Sans date limite*."
                    );
                    return;
                }
                taskForms.put(chatId, state.withDueDate(iso));
                sendExecutionKeyboard(chatId);
            }

            case AWAITING_EXECUTION ->
                sender.sendMessage(chatId, "👆 Choisissez via les boutons : Immédiate ou Planifiée.");

            case AWAITING_SCHEDULED_AT -> {
                String iso = parseDate(text);
                if (iso == null) {
                    sender.sendMessage(chatId,
                        "⚠️ Format : `jj/MM/aaaa HH:mm` _(ex: 15/07/2026 09:00)_"
                    );
                    return;
                }
                taskForms.put(chatId, state.withScheduledAt(iso));
                sendConfidentialKeyboard(chatId);
            }

            case AWAITING_CONFIDENTIAL ->
                sender.sendMessage(chatId, "👆 Choisissez la visibilité via les boutons.");

            case AWAITING_EXPECTED_RESULT -> {
                // L'utilisateur a tapé après avoir cliqué "Décrire librement"
                TaskFormState finalState = taskForms.remove(chatId);
                submitTask(chatId, finalState != null ? finalState : state, text);
            }
        }
    }

    // ── Keyboards inline ──────────────────────────────────────────────────────

    private void sendTypeKeyboard(long chatId) {
        String[][] types = TaskFormState.TASK_TYPES;
        List<List<Map<String, String>>> rows = new ArrayList<>();
        for (int i = 0; i + 1 < types.length; i += 2) {
            rows.add(List.of(
                btn(types[i][1],     "task:type:" + types[i][0]),
                btn(types[i + 1][1], "task:type:" + types[i + 1][0])
            ));
        }
        if (types.length % 2 != 0) {
            rows.add(List.of(btn(types[types.length - 1][1], "task:type:" + types[types.length - 1][0])));
        }
        sender.sendWithKeyboard(chatId, "📋 *Type de tâche*\n\nQuel type de tâche souhaitez-vous créer ?", rows);
    }

    private void sendPriorityKeyboard(long chatId) {
        String[][] p = TaskFormState.PRIORITIES;
        sender.sendWithKeyboard(chatId,
            "⚡ *Priorité*\n\nQuelle est l'urgence de cette tâche ?",
            List.of(
                List.of(btn(p[0][1], "task:priority:" + p[0][0]),
                        btn(p[1][1], "task:priority:" + p[1][0]),
                        btn(p[2][1], "task:priority:" + p[2][0])),
                List.of(btn(p[3][1], "task:priority:" + p[3][0]),
                        btn(p[4][1], "task:priority:" + p[4][0]))
            )
        );
    }

    private void sendDescriptionPrompt(long chatId) {
        sender.sendWithKeyboard(chatId,
            "📝 *Description*\n\n" +
            "Décrivez la tâche : contexte, instructions et contraintes.\n\n" +
            "Ou laissez l'IA générer une description basée sur le titre :",
            List.of(List.of(btn("🤖 Générer avec l'IA", "task:desc:ai")))
        );
    }

    private void sendNextAfterDescription(long chatId, TaskFormState state) {
        if (TaskFormState.requiresContacts(state.type())) {
            sendContactsPrompt(chatId);
        } else {
            sendProductsQuestion(chatId);
        }
    }

    private void sendContactsPrompt(long chatId) {
        sender.sendWithKeyboard(chatId,
            "👥 *Contacts / Destinataires*\n\n" +
            "Saisissez les emails séparés par des virgules :\n" +
            "_ex: client1@mail.com, client2@mail.com_\n\n" +
            "📎 Ou envoyez un fichier CSV/TXT.",
            List.of(
                List.of(btn("📋 Mes clients", "task:clients:pick"),
                        btn("⏭️ Ignorer", "task:skip:contacts"))
            )
        );
    }

    private void sendProductsQuestion(long chatId) {
        TaskFormState state = taskForms.get(chatId);
        boolean suggests = state != null && TaskFormState.suggestsProducts(state.type());
        String hint = suggests
            ? "💡 Ce type de tâche est souvent associé à des produits."
            : "Optionnel — associez des produits si pertinent.";
        sender.sendWithKeyboard(chatId,
            "📦 *Produits*\n\n" + hint,
            List.of(
                List.of(btn("📦 Sélectionner mes produits", "task:products:pick"),
                        btn("⏭️ Ignorer", "task:skip:products"))
            )
        );
    }

    private void sendClientPickerMenu(long chatId) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Session expirée."); return; }
        try {
            String json = agentTeamClient.fetchClients(session.jwtToken());
            com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(json);
            if (arr.has("error")) {
                sender.sendMessage(chatId,
                    "❌ Impossible de charger vos clients (compte introuvable ou session expirée).\n" +
                    "Tapez /unlink puis /link pour reconnecter votre compte.");
                return;
            }
            if (!arr.isArray() || arr.isEmpty()) {
                sender.sendMessage(chatId,
                    "ℹ️ Aucun client dans votre liste.\n" +
                    "Ajoutez des clients depuis l'application CreativeAI Studio, ou saisissez les emails manuellement ci-dessous.");
                return;
            }
            List<List<Map<String, String>>> rows = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode c : arr) {
                String code  = c.path("code").asText();
                String label = c.path("nom").asText() + " " + c.path("prenoms").asText("") + " — " + c.path("email").asText("");
                rows.add(List.of(btn(label.trim(), "task:client:add:" + code)));
            }
            rows.add(List.of(btn("✅ Valider la sélection", "task:clients:confirm"),
                             btn("⏭️ Ignorer", "task:skip:contacts")));
            TaskFormState s = taskForms.get(chatId);
            int already = s != null && s.contacts() != null ? s.contacts().size() : 0;
            sender.sendWithKeyboard(chatId,
                "👥 *Sélectionner vos clients*\n\n" +
                (already > 0 ? already + " contact(s) déjà ajouté(s). " : "") +
                "Cliquez pour ajouter :", rows);
        } catch (Exception e) {
            sender.sendMessage(chatId, "❌ Impossible de charger vos clients : " + e.getMessage());
        }
    }

    private void sendProductPickerMenu(long chatId) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Session expirée."); return; }
        try {
            String json = agentTeamClient.fetchProducts(session.jwtToken());
            com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray() || arr.isEmpty()) {
                sender.sendMessage(chatId, "ℹ️ Aucun produit dans votre liste. Passage à l'étape suivante.");
                TaskFormState s = taskForms.get(chatId);
                if (s != null) taskForms.put(chatId, s.skipProducts());
                sendDueDatePrompt(chatId);
                return;
            }
            List<List<Map<String, String>>> rows = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode p : arr) {
                String code  = p.path("code").asText();
                String prix  = p.path("prix").asText("");
                String label = p.path("nom").asText() + (prix.isBlank() ? "" : " — " + prix + "€");
                rows.add(List.of(btn(label, "task:product:toggle:" + code)));
            }
            rows.add(List.of(btn("✅ Valider", "task:products:confirm"),
                             btn("⏭️ Ignorer", "task:skip:products")));
            TaskFormState s = taskForms.get(chatId);
            int already = s != null && s.productCodes() != null ? s.productCodes().size() : 0;
            sender.sendWithKeyboard(chatId,
                "📦 *Sélectionner vos produits*\n\n" +
                (already > 0 ? already + " produit(s) sélectionné(s). " : "") +
                "Cliquez pour cocher/décocher :", rows);
        } catch (Exception e) {
            sender.sendMessage(chatId, "❌ Impossible de charger vos produits : " + e.getMessage());
        }
    }

    private void sendDueDatePrompt(long chatId) {
        sender.sendWithKeyboard(chatId,
            "📅 *Date limite (optionnelle)*\n\n" +
            "Format : `jj/MM/aaaa HH:mm` _(ex: 30/06/2026 17:00)_",
            List.of(List.of(btn("⏭️ Sans date limite", "task:skip:duedate")))
        );
    }

    private void sendExecutionKeyboard(long chatId) {
        sender.sendWithKeyboard(chatId,
            "🕐 *Mode d'exécution*\n\nQuand l'agent doit-il commencer ?",
            List.of(List.of(
                btn("⚡ Immédiate", "task:exec:immediate"),
                btn("⏰ Planifiée", "task:exec:scheduled")
            ))
        );
    }

    private void sendConfidentialKeyboard(long chatId) {
        sender.sendWithKeyboard(chatId,
            "🔐 *Confidentialité*\n\nVisibilité de la tâche dans votre équipe :",
            List.of(List.of(
                btn("🌐 Public équipe", "task:conf:public"),
                btn("🔒 Confidentiel",  "task:conf:private")
            ))
        );
    }

    private void sendExpectedResultKeyboard(long chatId, String type) {
        String[] suggestions = TaskFormState.resultSuggestions(type);
        List<List<Map<String, String>>> rows = new ArrayList<>();
        for (int i = 0; i < suggestions.length; i++) {
            rows.add(List.of(btn(suggestions[i], "task:result:" + i)));
        }
        rows.add(List.of(btn("✏️ Décrire librement", "task:result:custom")));
        sender.sendWithKeyboard(chatId,
            "🎯 *Résultat attendu*\n\nQue souhaitez-vous obtenir comme livrable ?", rows);
    }

    private Map<String, String> btn(String text, String data) {
        return Map.of("text", text.strip(), "callback_data", data);
    }

    // ── Import fichier contacts (CSV/TXT) ──────────────────────────────────────

    private void handleContactFileUpload(long chatId, JsonNode doc) {
        TaskFormState state = taskForms.get(chatId);
        if (state == null || state.step() != TaskFormState.Step.AWAITING_CONTACTS) {
            sender.sendMessage(chatId, "⚠️ Fichier reçu mais aucun formulaire en attente de contacts.");
            return;
        }

        String fileName = doc.path("file_name").asText("");
        String fileId   = doc.path("file_id").asText("");

        if (!fileName.toLowerCase().endsWith(".csv") && !fileName.toLowerCase().endsWith(".txt")) {
            sender.sendMessage(chatId, "⚠️ Format non supporté. Envoyez un fichier CSV ou TXT.");
            return;
        }

        sender.sendMessage(chatId, "⏳ Analyse du fichier en cours...");

        try {
            String token = props.telegram().botToken();

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.telegram.org/bot" + token + "/getFile?file_id=" + fileId))
                .timeout(Duration.ofSeconds(10)).GET().build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

            JsonNode fileInfo = objectMapper.readTree(resp.body());
            String filePath   = fileInfo.path("result").path("file_path").asText();

            HttpRequest dlReq = HttpRequest.newBuilder()
                .uri(URI.create("https://api.telegram.org/file/bot" + token + "/" + filePath))
                .timeout(Duration.ofSeconds(30)).GET().build();
            HttpResponse<String> dlResp = httpClient.send(dlReq, HttpResponse.BodyHandlers.ofString());

            List<String> emails = extractEmails(dlResp.body());

            if (emails.isEmpty()) {
                sender.sendMessage(chatId,
                    "⚠️ Aucun email trouvé dans le fichier. Saisissez manuellement ou appuyez sur *Ignorer*."
                );
                return;
            }

            taskForms.put(chatId, state.withContacts(emails));
            sender.sendMessage(chatId,
                "✅ *" + emails.size() + " contact(s) importé(s)* depuis `" + fileName + "`\n\n" +
                String.join("\n", emails.subList(0, Math.min(5, emails.size()))) +
                (emails.size() > 5 ? "\n_…et " + (emails.size() - 5) + " autres_" : "")
            );
            sendDueDatePrompt(chatId);

        } catch (Exception e) {
            log.error("[TASK_FORM] File import error chatId={}: {}", chatId, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Impossible de lire le fichier. Saisissez les emails manuellement.");
        }
    }

    // ── Génération IA de description ───────────────────────────────────────────

    private void generateAiDescription(long chatId, TaskFormState state) {
        sender.sendTyping(chatId);
        sender.sendMessage(chatId, "🤖 Génération de la description en cours...");
        try {
            String prompt = String.format(
                "Génère une description détaillée et précise pour une tâche intitulée \"%s\" de type %s. " +
                "La description doit inclure : le contexte, les instructions précises, les contraintes et les données utiles. " +
                "Réponds uniquement avec la description (pas de titre, pas d'introduction).",
                state.title(), state.type()
            );
            String generated = org.springframework.ai.chat.client.ChatClient.builder(chatModel)
                .build().prompt().user(prompt).call().content();

            taskForms.put(chatId, state.pendingAiDesc(generated));
            // Envoyer la description en texte brut (évite les conflits Markdown avec le contenu IA)
            sender.sendMessage(chatId, "🤖 Description générée :\n\n" + generated, "");
            sender.sendWithKeyboard(chatId,
                "Que souhaitez-vous faire avec cette description ?",
                List.of(List.of(
                    btn("✅ Confirmer", "task:desc:confirm"),
                    btn("✏️ Modifier",  "task:desc:edit")
                ))
            );
        } catch (Exception e) {
            log.error("[AI_DESC] Error: {}", e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Génération IA échouée. Saisissez votre description :");
            taskForms.put(chatId, state.withPriority(state.priority())); // reste en AWAITING_DESCRIPTION
        }
    }

    // ── Soumission finale ─────────────────────────────────────────────────────

    private static final java.util.regex.Pattern UUID_PATTERN =
        java.util.regex.Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private void submitTask(long chatId, TaskFormState s, String expectedResult) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "Session expiree. Tapez /link.", null); return; }

        sender.sendTyping(chatId);
        sender.sendMessage(chatId, "Creation de la tache en cours...", null);

        String contactsJson = buildContactsJson(s);
        String productsJson = buildProductsJson(s);

        UserContextHolder.set(session.userId(), session.jwtToken());
        try {
            String result = agentTeamClient.createTask(
                session.userId(), session.jwtToken(),
                s.title(), s.description(), s.type(), s.priority(),
                null, expectedResult, contactsJson, productsJson,
                s.dueDate(), s.scheduledAt(), s.confidential()
            );

            if (result != null && result.contains("\"error\"")) {
                String errMsg = extractField(result, "message");
                if (errMsg.isBlank()) errMsg = extractField(result, "error");
                sender.sendMessage(chatId, "Erreur lors de la creation de la tache : " + errMsg, null);
                return;
            }

            String taskId = extractField(result, "id");

            sender.sendMessage(chatId,
                "Tache creee !\n" +
                "Titre : " + s.title() + "\n" +
                "Type : " + s.type() + "\n" +
                "Priorite : " + s.priority() + "\n" +
                (s.contacts() != null && !s.contacts().isEmpty()
                    ? "Contacts : " + s.contacts().size() + " destinataire(s)\n" : "") +
                (taskId.isBlank() ? "" : "ID : " + taskId + "\n") +
                "\nLe Scrum Master va analyser et assigner la tache...", null);

            if (!taskId.isBlank()) {
                final String fTaskId   = taskId;
                final String fExpected = expectedResult;
                Thread.ofVirtual().start(() ->
                    executeTaskFlow(chatId, fTaskId, s, fExpected, session));
            }

        } catch (Exception e) {
            log.error("[TASK_FORM] Submit error chatId={}: {}", chatId, e.getMessage(), e);
            sender.sendMessage(chatId, "Erreur : " + e.getMessage(), null);
        } finally {
            UserContextHolder.clear();
        }
    }

    // ── Exécution automatique (thread virtuel) ─────────────────────────────────

    private void executeTaskFlow(long chatId, String taskId, TaskFormState s,
                                 String expectedResult, UserSession session) {
        String jwt    = session.jwtToken();
        String userId = session.userId();
        UserContextHolder.set(userId, jwt);
        try {
            // ── [1/3] Trouver le Scrum Master ─────────────────────────────
            String scrumMasterId = agentTeamClient.findAgentForTaskType("SCRUM", jwt);
            if (scrumMasterId == null) {
                agentTeamClient.updateTaskStatus(taskId, "FAILED", jwt);
                sender.sendMessage(chatId,
                    "Aucun Scrum Master actif trouve. La tache reste en attente dans l'inbox.", null);
                return;
            }

            agentTeamClient.updateTaskStatus(taskId, "IN_PROGRESS", jwt);

            String agentsJson    = agentTeamClient.listAgents(userId, jwt, 0, 20);
            String agentsSummary = buildAgentsSummary(agentsJson);

            sender.sendMessage(chatId, "[1/3] Scrum Master : analyse de la tache en cours...", null);

            String scrumPrompt =
                "Tache a analyser et a assigner (ID: " + taskId + ")\n" +
                "Titre       : " + s.title() + "\n" +
                "Type        : " + s.type()  + "\n" +
                "Priorite    : " + s.priority() + "\n" +
                "Description : " + (s.description() != null ? s.description() : "(aucune)") + "\n" +
                "Contacts    : " + (s.contacts() != null && !s.contacts().isEmpty()
                                        ? String.join(", ", s.contacts()) : "aucun") + "\n" +
                "Resultat attendu : " + expectedResult + "\n\n" +
                "Agents disponibles dans l'equipe :\n" + agentsSummary + "\n\n" +
                "Analyse cette tache, choisis l'agent le plus competent pour l'executer et assigne-la lui. " +
                "Sur la DERNIERE ligne de ta reponse, ecris exactement (sans autre texte apres) :\n" +
                "ASSIGNED_TO=<uuid_de_lagent>";

            String scrumRaw  = agentTeamClient.chatWithAgent(userId, jwt, scrumMasterId, scrumPrompt, null);
            String scrumText = extractChatResponse(scrumRaw);
            log.info("[EXEC] taskId={} scrumResponse={}", taskId,
                scrumText.length() > 200 ? scrumText.substring(0, 200) + "…" : scrumText);

            // ── [2/3] Parser l'agent assigné ──────────────────────────────
            String assignedId = parseAssignedAgentId(scrumText, agentsJson);
            log.info("[EXEC] taskId={} assignedId={}", taskId, assignedId);

            if (assignedId == null || assignedId.isBlank() || assignedId.equals(scrumMasterId)) {
                agentTeamClient.updateTaskStatus(taskId, "DONE", jwt);
                sender.sendMessage(chatId,
                    "[2/3] Scrum Master a traite la tache directement.\n\n" +
                    cleanResponse(scrumText) + "\n\n" +
                    "[3/3] Tache terminee. Statut inbox : COMPLETED", null);
                return;
            }

            String agentName = getAgentName(assignedId, agentsJson);
            sender.sendMessage(chatId,
                "[2/3] Scrum Master a assigne la tache a : " + agentName + "\n" +
                "Execution en cours...", null);

            // ── [3/3] Appeler l'agent d'exécution ─────────────────────────
            String execPrompt =
                "Execute la tache suivante (ID: " + taskId + ")\n" +
                "Titre       : " + s.title() + "\n" +
                "Type        : " + s.type()  + "\n" +
                "Description : " + (s.description() != null ? s.description() : "(aucune)") + "\n" +
                "Contacts    : " + (s.contacts() != null && !s.contacts().isEmpty()
                                        ? String.join(", ", s.contacts()) : "aucun") + "\n" +
                "Resultat attendu : " + expectedResult + "\n\n" +
                "Execute cette tache maintenant.";

            String execRaw  = agentTeamClient.chatWithAgent(userId, jwt, assignedId, execPrompt, null);
            String execText = extractChatResponse(execRaw);
            boolean success = !execRaw.contains("\"error\"");

            agentTeamClient.updateTaskStatus(taskId, success ? "DONE" : "FAILED", jwt);

            sender.sendMessage(chatId,
                "[3/3] " + (success ? "Tache executee avec succes !" : "Echec de l'execution.") + "\n\n" +
                cleanResponse(execText) + "\n\n" +
                "Statut inbox : " + (success ? "DONE" : "FAILED"), null);

        } catch (Exception e) {
            log.error("[EXEC] taskId={} error: {}", taskId, e.getMessage(), e);
            try { agentTeamClient.updateTaskStatus(taskId, "FAILED", jwt); } catch (Exception ignored) {}
            sender.sendMessage(chatId,
                "Erreur lors de l'execution de la tache :\n" + e.getMessage(), null);
        } finally {
            UserContextHolder.clear();
        }
    }

    // ── Helpers d'exécution ───────────────────────────────────────────────────

    private String buildContactsJson(TaskFormState s) {
        if (s.contacts() == null || s.contacts().isEmpty()) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < s.contacts().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"email\":\"").append(s.contacts().get(i)).append("\"}");
        }
        return sb.append("]").toString();
    }

    private String buildProductsJson(TaskFormState s) {
        if (s.productCodes() == null || s.productCodes().isEmpty()) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < s.productCodes().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"code\":\"").append(s.productCodes().get(i)).append("\"}");
        }
        return sb.append("]").toString();
    }

    private String buildAgentsSummary(String agentsJson) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(agentsJson);
            com.fasterxml.jackson.databind.JsonNode arr  = root.isArray() ? root : root.path("content");
            StringBuilder sb = new StringBuilder();
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                if ("ACTIVE".equals(a.path("status").asText())) {
                    sb.append("- ID=").append(a.path("id").asText())
                      .append(", nom=").append(a.path("name").asText())
                      .append(", type=").append(a.path("type").asText())
                      .append("\n");
                }
            }
            return sb.isEmpty() ? "(aucun agent actif)" : sb.toString().trim();
        } catch (Exception e) {
            return "(liste indisponible)";
        }
    }

    private String parseAssignedAgentId(String scrumText, String agentsJson) {
        // Priority 1: explicit ASSIGNED_TO=<uuid> marker
        java.util.regex.Matcher m = Pattern.compile(
            "ASSIGNED_TO=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
            java.util.regex.Pattern.CASE_INSENSITIVE).matcher(scrumText);
        if (m.find()) return m.group(1);

        // Priority 2: any UUID in the response that matches an active agent
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(agentsJson);
            com.fasterxml.jackson.databind.JsonNode arr  = root.isArray() ? root : root.path("content");
            java.util.regex.Matcher um = UUID_PATTERN.matcher(scrumText);
            while (um.find()) {
                String candidate = um.group();
                for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                    if (candidate.equals(a.path("id").asText()) &&
                        "ACTIVE".equals(a.path("status").asText())) {
                        return candidate;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String extractChatResponse(String chatRaw) {
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(chatRaw);
            String resp = node.path("response").asText("");
            if (!resp.isBlank()) return resp;
            String err = node.path("error").asText("");
            return err.isBlank() ? chatRaw : "(erreur agent) " + err;
        } catch (Exception e) {
            return chatRaw != null ? chatRaw : "";
        }
    }

    private String getAgentName(String agentId, String agentsJson) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(agentsJson);
            com.fasterxml.jackson.databind.JsonNode arr  = root.isArray() ? root : root.path("content");
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                if (agentId.equals(a.path("id").asText()))
                    return a.path("name").asText(agentId);
            }
        } catch (Exception ignored) {}
        return agentId;
    }

    private String cleanResponse(String text) {
        // Remove the ASSIGNED_TO=... marker line if present
        return text.replaceAll("(?im)^ASSIGNED_TO=.*$", "").replaceAll("\n{3,}", "\n\n").trim();
    }

    // ── Nouvelles commandes ───────────────────────────────────────────────────

    private void handleTasksList(long chatId, String statusArg) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);
        String status = statusArg.isBlank() ? null : statusArg.toUpperCase();
        String json = agentTeamClient.listTasks(session.userId(), session.jwtToken(), status, 10);

        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
            if (root.has("error")) {
                sender.sendMessage(chatId, "❌ Impossible de charger les tâches.");
                return;
            }
            com.fasterxml.jackson.databind.JsonNode arr = root.isArray() ? root : root.path("content");
            if (!arr.isArray() || arr.isEmpty()) {
                String label = status != null ? " *" + status + "*" : "";
                sender.sendMessage(chatId, "ℹ️ Aucune tâche" + label + " trouvée.");
                return;
            }
            StringBuilder sb = new StringBuilder();
            String label = status != null ? " — " + statusEmoji(status) + " " + status : "";
            sb.append("*📋 Tâches").append(label).append("*\n\n");
            for (com.fasterxml.jackson.databind.JsonNode t : arr) {
                String code     = t.path("code").asText("?");
                String title    = t.path("title").asText("(sans titre)");
                String tStatus  = t.path("status").asText("-");
                String priority = t.path("priority").asText("");
                sb.append(statusEmoji(tStatus)).append(" `").append(code).append("` — *").append(title).append("*\n");
                sb.append("   Priorité : ").append(priorityEmoji(priority)).append(" ").append(priority)
                  .append("\n\n");
            }
            sb.append("_Tapez /task <code> pour voir le détail_");
            sender.sendMessage(chatId, sb.toString().trim());
        } catch (Exception e) {
            log.error("[TASKS_LIST] chatId={}: {}", chatId, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
        }
    }

    private void handleTaskDetail(long chatId, String code) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);
        String json = agentTeamClient.getTaskByCode(session.userId(), session.jwtToken(), code);

        try {
            com.fasterxml.jackson.databind.JsonNode t = objectMapper.readTree(json);
            if (t.has("error")) {
                sender.sendMessage(chatId, "❌ Tâche introuvable pour le code `" + code + "`.");
                return;
            }
            String title       = t.path("title").asText("-");
            String status      = t.path("status").asText("-");
            String priority    = t.path("priority").asText("-");
            String type        = t.path("type").asText("-");
            String description = t.path("description").asText("");
            String dueDate     = t.path("dueDate").asText("");
            String createdAt   = t.path("createdAt").asText("");

            StringBuilder sb = new StringBuilder();
            sb.append("*📋 ").append(title).append("*\n\n");
            sb.append("Code     : `").append(code).append("`\n");
            sb.append("Statut   : ").append(statusEmoji(status)).append(" ").append(status).append("\n");
            sb.append("Type     : ").append(type).append("\n");
            sb.append("Priorité : ").append(priorityEmoji(priority)).append(" ").append(priority).append("\n");
            if (!dueDate.isBlank())     sb.append("Échéance : ").append(formatIso(dueDate)).append("\n");
            if (!createdAt.isBlank())   sb.append("Créée le : ").append(formatIso(createdAt)).append("\n");
            if (!description.isBlank()) sb.append("\n📝 _").append(description).append("_");
            sender.sendMessage(chatId, sb.toString().trim());
        } catch (Exception e) {
            log.error("[TASK_DETAIL] chatId={} code={}: {}", chatId, code, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
        }
    }

    private void handleAgentsList(long chatId) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);
        String json = agentTeamClient.listAgents(session.userId(), session.jwtToken(), 0, 20);

        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
            if (root.has("error")) {
                sender.sendMessage(chatId, "❌ Impossible de charger les agents.");
                return;
            }
            com.fasterxml.jackson.databind.JsonNode arr = root.isArray() ? root : root.path("content");
            if (!arr.isArray() || arr.isEmpty()) {
                sender.sendMessage(chatId, "ℹ️ Aucun agent trouvé. Créez-en un depuis l'application.");
                return;
            }
            StringBuilder sb = new StringBuilder("*🤖 Vos agents*\n\n");
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                String code   = a.path("code").asText("?");
                String name   = a.path("name").asText("-");
                String type   = a.path("type").asText("-");
                String status = a.path("status").asText("-");
                sb.append(agentStatusEmoji(status)).append(" `").append(code).append("` — *").append(name).append("*\n");
                sb.append("   Type : ").append(type).append("\n\n");
            }
            sb.append("_/agent <code> pour le détail · /chat <code> <message> pour discuter_");
            sender.sendMessage(chatId, sb.toString().trim());
        } catch (Exception e) {
            log.error("[AGENTS_LIST] chatId={}: {}", chatId, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
        }
    }

    private void handleAgentDetail(long chatId, String code) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);
        String json = agentTeamClient.getAgentByCode(session.userId(), session.jwtToken(), code);

        try {
            com.fasterxml.jackson.databind.JsonNode a = objectMapper.readTree(json);
            if (a.has("error")) {
                sender.sendMessage(chatId, "❌ Agent introuvable pour le code `" + code + "`.");
                return;
            }
            String name        = a.path("name").asText("-");
            String type        = a.path("type").asText("-");
            String status      = a.path("status").asText("-");
            String description = a.path("description").asText("");
            String createdAt   = a.path("createdAt").asText("");

            StringBuilder sb = new StringBuilder();
            sb.append("*🤖 ").append(name).append("*\n\n");
            sb.append("Code    : `").append(code).append("`\n");
            sb.append("Type    : ").append(type).append("\n");
            sb.append("Statut  : ").append(agentStatusEmoji(status)).append(" ").append(status).append("\n");
            if (!createdAt.isBlank()) sb.append("Créé le : ").append(formatIso(createdAt)).append("\n");
            if (!description.isBlank()) sb.append("\n📝 _").append(description).append("_\n");
            sb.append("\n_/chat ").append(code).append(" <votre message> pour discuter avec cet agent_");
            sender.sendMessage(chatId, sb.toString().trim());
        } catch (Exception e) {
            log.error("[AGENT_DETAIL] chatId={} code={}: {}", chatId, code, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
        }
    }

    private void handleChatWithAgent(long chatId, String code, String message) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);

        // Resolve code → UUID
        String agentJson = agentTeamClient.getAgentByCode(session.userId(), session.jwtToken(), code);
        try {
            com.fasterxml.jackson.databind.JsonNode a = objectMapper.readTree(agentJson);
            if (a.has("error")) {
                sender.sendMessage(chatId, "❌ Agent introuvable pour le code `" + code + "`.");
                return;
            }
            String agentId   = a.path("id").asText("");
            String agentName = a.path("name").asText(code);

            if (agentId.isBlank()) {
                sender.sendMessage(chatId, "❌ Impossible de résoudre l'agent `" + code + "`.");
                return;
            }

            sender.sendMessage(chatId, "💬 Discussion avec *" + agentName + "* en cours…");

            UserContextHolder.set(session.userId(), session.jwtToken());
            try {
                String rawResp = agentTeamClient.chatWithAgent(
                    session.userId(), session.jwtToken(), agentId, message, null);
                String response = extractChatResponse(rawResp);
                sender.sendMessage(chatId,
                    "*🤖 " + agentName + "* :\n\n" + (response.isBlank() ? "_(réponse vide)_" : response));
            } finally {
                UserContextHolder.clear();
            }
        } catch (Exception e) {
            log.error("[CHAT_AGENT] chatId={} code={}: {}", chatId, code, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : " + e.getMessage());
        }
    }

    private String statusEmoji(String status) {
        if (status == null) return "•";
        return switch (status.toUpperCase()) {
            case "PENDING"     -> "⏳";
            case "IN_PROGRESS" -> "🔄";
            case "DONE"        -> "✅";
            case "FAILED"      -> "❌";
            case "CANCELLED"   -> "🚫";
            default            -> "•";
        };
    }

    private String priorityEmoji(String priority) {
        if (priority == null) return "";
        return switch (priority.toUpperCase()) {
            case "CRITICAL" -> "🔴";
            case "HIGH"     -> "🟠";
            case "MEDIUM"   -> "🟡";
            case "LOW"      -> "🟢";
            default         -> "";
        };
    }

    private String agentStatusEmoji(String status) {
        if (status == null) return "•";
        return switch (status.toUpperCase()) {
            case "ACTIVE"   -> "🟢";
            case "INACTIVE" -> "🔴";
            case "PAUSED"   -> "🟡";
            default         -> "•";
        };
    }

    // ── Autres commandes ──────────────────────────────────────────────────────

    private void handleUnlink(long chatId) {
        awaitingEmail.remove(chatId);
        taskForms.remove(chatId);
        sessionStore.unlink(chatId);
        sender.sendMessage(chatId, "✅ Compte délié. Tapez /link pour vous reconnecter.");
    }

    private void handleClear(long chatId) {
        if (!sessionStore.isLinked(chatId)) { sender.sendMessage(chatId, "⚠️ Aucun compte lié."); return; }
        sessionStore.resetSession(chatId);
        sender.sendMessage(chatId, "🔄 Mémoire conversationnelle effacée.");
    }

    private void handleMenu(long chatId) {
        sender.sendMessage(chatId, """
            *📌 CreativeAI Studio — Menu*

            *Compte*
            /link            — 🔗 Lier votre compte
            /unlink          — 🔓 Délier votre compte

            *Tâches*
            /newtask         — 📋 Créer une tâche (formulaire guidé)
            /tasks           — 📄 Lister toutes vos tâches
            /tasks pending   — ⏳ Tâches en attente
            /tasks in_progress — 🔄 Tâches en cours
            /tasks done      — ✅ Tâches terminées
            /task <code>     — 🔍 Détail d'une tâche par code

            *Agents*
            /agents          — 🤖 Lister vos agents
            /agent <code>    — 🔍 Détail d'un agent par code
            /chat <code> <message> — 💬 Discuter avec un agent

            *Conversation*
            /clear           — 🔄 Effacer l'historique
            /annuler         — ❌ Annuler l'opération en cours
            """);
    }

    // ── Messages IA ──────────────────────────────────────────────────────────

    private void handleAiMessage(long chatId, String text) {
        UserSession session = sessionStore.find(chatId).orElse(null);
        if (session == null) { sender.sendMessage(chatId, "⚠️ Compte non lié. Tapez /link."); return; }

        sender.sendTyping(chatId);
        UserContextHolder.set(session.userId(), session.jwtToken());
        try {
            String response = chatClient.prompt()
                .user(text)
                .advisors(a -> a.param("chat_memory_conversation_id", session.sessionId()))
                .call()
                .content();
            sender.sendMessage(chatId, response != null ? response : "_(pas de réponse)_");
        } catch (Exception e) {
            log.error("[AI] chatId={}: {}", chatId, e.getMessage(), e);
            sender.sendMessage(chatId, "❌ Erreur : `" + e.getMessage() + "`");
        } finally {
            UserContextHolder.clear();
        }
    }

    // ── Utils ─────────────────────────────────────────────────────────────────

    private List<String> extractEmails(String text) {
        List<String> emails = new ArrayList<>();
        Matcher m = EMAIL_PATTERN.matcher(text);
        while (m.find()) emails.add(m.group().toLowerCase());
        return emails;
    }

    private String parseDate(String text) {
        try {
            return LocalDateTime.parse(text.trim(), DATE_FMT).toString();
        } catch (Exception e) { return null; }
    }

    private String formatIso(String iso) {
        try {
            return LocalDateTime.parse(iso).format(DATE_FMT);
        } catch (Exception e) { return iso; }
    }

    private String extractField(String json, String field) {
        try {
            return objectMapper.readTree(json).path(field).asText("");
        } catch (Exception e) { return ""; }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? email : email.charAt(0) + "***" + email.substring(at);
    }
}
