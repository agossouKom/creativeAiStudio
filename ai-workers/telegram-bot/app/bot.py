"""
Bot Telegram — CreativeAI Studio
Mode polling (pas besoin d'URL publique HTTPS).

Flux :
  1. L'utilisateur envoie /register <userId> pour lier son compte Telegram au userId plateforme.
  2. Chaque message suivant est transmis au backend webhook → création automatique de tâche.
  3. Le bot répond avec l'ID de la tâche créée ou un message d'erreur.

Commandes :
  /start              — Message de bienvenue
  /register <userId>  — Lier ce chat Telegram à un userId de la plateforme
  /help               — Format de message structuré
  /status             — Vérifier la liaison de compte
"""

import os
import json
import logging
import requests
import telebot
from telebot.types import Message

# ── Config ────────────────────────────────────────────────────────────────────

BOT_TOKEN       = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BACKEND_URL     = os.environ.get("BACKEND_URL", "http://agent-team-service:8087")
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "")  # userId par défaut (mono-utilisateur)
MAPPING_FILE    = "/data/user_mapping.json"               # persistance chat_id → userId

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [TELEGRAM-BOT] %(levelname)s — %(message)s"
)
log = logging.getLogger(__name__)

if not BOT_TOKEN:
    log.error("TELEGRAM_BOT_TOKEN non configuré — bot inactif")
    import time; time.sleep(9999)

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="Markdown")

# ── Persistance mapping ───────────────────────────────────────────────────────

def load_mapping() -> dict:
    try:
        os.makedirs(os.path.dirname(MAPPING_FILE), exist_ok=True)
        with open(MAPPING_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        log.warning("Impossible de lire le mapping: %s", e)
        return {}

def save_mapping(mapping: dict):
    try:
        os.makedirs(os.path.dirname(MAPPING_FILE), exist_ok=True)
        with open(MAPPING_FILE, "w") as f:
            json.dump(mapping, f, indent=2)
    except Exception as e:
        log.warning("Impossible de sauvegarder le mapping: %s", e)

user_mapping: dict = load_mapping()

def get_platform_user_id(chat_id: int) -> str | None:
    return user_mapping.get(str(chat_id)) or DEFAULT_USER_ID or None

# ── Commandes ─────────────────────────────────────────────────────────────────

@bot.message_handler(commands=["start"])
def cmd_start(msg: Message):
    name = msg.from_user.first_name or "utilisateur"
    platform_id = get_platform_user_id(msg.chat.id)
    status_line = (
        f"✅ Compte lié à `{platform_id[:8]}…`" if platform_id
        else "⚠️ Compte non lié — utilisez `/register <userId>`"
    )

    bot.reply_to(msg, f"""
👋 Bonjour *{name}* !

Bienvenue sur le bot *CreativeAI Studio*.
Envoyez des tâches structurées directement depuis Telegram.

{status_line}

Tapez /help pour voir le format des messages.
""")


@bot.message_handler(commands=["register"])
def cmd_register(msg: Message):
    parts = msg.text.strip().split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        bot.reply_to(msg, "❌ Usage : `/register <userId>`\n\nTrouvez votre userId dans les paramètres de la plateforme CreativeAI.")
        return

    platform_user_id = parts[1].strip()
    chat_id = str(msg.chat.id)

    # Vérification optionnelle — ping le backend
    try:
        resp = requests.get(
            f"{BACKEND_URL}/actuator/health",
            timeout=5
        )
        if resp.status_code != 200:
            bot.reply_to(msg, "⚠️ Backend inaccessible. Liaison enregistrée localement quand même.")
    except Exception:
        bot.reply_to(msg, "⚠️ Backend inaccessible. Liaison enregistrée localement.")

    user_mapping[chat_id] = platform_user_id
    save_mapping(user_mapping)

    log.info("Liaison Telegram chat_id=%s → platformUserId=%s", chat_id, platform_user_id)
    bot.reply_to(msg, f"✅ Compte lié avec succès !\n\nVotre ID plateforme : `{platform_user_id}`\nVous pouvez maintenant créer des tâches.")


@bot.message_handler(commands=["status"])
def cmd_status(msg: Message):
    platform_id = get_platform_user_id(msg.chat.id)
    if platform_id:
        bot.reply_to(msg, f"✅ Compte lié : `{platform_id}`\n\nTout message que vous envoyez crée une tâche sur la plateforme.")
    else:
        bot.reply_to(msg, "❌ Aucun compte lié.\n\nUtilisez `/register <userId>` pour commencer.")


@bot.message_handler(commands=["help"])
def cmd_help(msg: Message):
    bot.reply_to(msg, """
📋 *Format de tâche structurée*

Envoyez un message avec ce format :

```
Titre: Rédiger rapport mensuel
Description: Analyse des KPIs du mois de juin avec recommandations
Équipe: Marketing
Type: REPORT_GENERATE
Priorité: HIGH
Date limite: 30/06/2026 18:00
Confidentialité: non
Résultat attendu: Rapport Word prêt à partager
```

Ou avec les emojis :
```
Titre: Préparer la présentation client
👥 Contacts: client@exemple.com
Description: Slides pour la réunion du 15 juillet
🏢 Équipe: Commercial
📂 Type: PRESENTATION_CREATE
⚡ Priorité: HIGH
⏰ Date limite: 14/07/2026
🎯 Résultat attendu: Présentation 15 slides
```

*Types de tâches disponibles :*
`GENERAL` `EMAIL_RESPONSE` `REPORT_GENERATE`
`PRESENTATION_CREATE` `DOCUMENT_PDF`
`ACCOUNTING_REPORT` `SOCIAL_CONTENT`
`CONTENT_GENERATE` `CV_CREATE` `DOCUMENT_SUMMARIZE`

*Priorités :* `LOW` `MEDIUM` `HIGH` `URGENT` `CRITICAL`
""")


# ── Handler principal — création de tâche ─────────────────────────────────────

@bot.message_handler(func=lambda msg: True, content_types=["text"])
def handle_task_message(msg: Message):
    chat_id = msg.chat.id
    platform_user_id = get_platform_user_id(chat_id)

    if not platform_user_id:
        bot.reply_to(msg, "⚠️ Compte non lié. Utilisez `/register <userId>` pour commencer.")
        return

    text = (msg.text or "").strip()
    if not text:
        return

    log.info("Message de chat_id=%s → userId=%s: %s…", chat_id, platform_user_id, text[:60])

    # Construction du payload au format attendu par TelegramWebhookController
    payload = {
        "update_id": msg.message_id,
        "message": {
            "message_id": msg.message_id,
            "from": {
                "id": msg.from_user.id,
                "username": msg.from_user.username or "",
                "first_name": msg.from_user.first_name or ""
            },
            "chat": {"id": chat_id},
            "text": text
        }
    }

    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/telegram/webhook/{platform_user_id}",
            json=payload,
            timeout=15
        )
        data = resp.json()

        if data.get("ok") and data.get("taskId"):
            task_id = data["taskId"]
            bot.reply_to(msg, f"✅ *Tâche créée !*\n\nID : `{task_id[:8]}…`\n\nVous recevrez le résultat dans votre inbox.")
        elif data.get("ok"):
            bot.reply_to(msg, "✅ Message reçu et traité.")
        else:
            err = data.get("error", "Erreur inconnue")
            log.warning("Backend a retourné ok=false: %s", err)
            bot.reply_to(msg, f"❌ Erreur du serveur : `{err}`")

    except requests.Timeout:
        log.error("Timeout lors de l'appel au backend")
        bot.reply_to(msg, "⏱️ Délai dépassé. Réessayez dans quelques secondes.")
    except Exception as e:
        log.error("Erreur appel backend: %s", e)
        bot.reply_to(msg, f"❌ Erreur de connexion : `{str(e)[:80]}`")


# ── Lancement ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    info = bot.get_me()
    log.info("Bot démarré : @%s (%s) — polling actif", info.username, info.first_name)
    log.info("Backend URL : %s", BACKEND_URL)
    log.info("DEFAULT_USER_ID : %s", DEFAULT_USER_ID or "(non défini)")

    bot.infinity_polling(timeout=20, long_polling_timeout=15)
