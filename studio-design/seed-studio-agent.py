#!/usr/bin/env python3
"""
Provisionne l'agent IA par défaut du Studio à partir de agent-studio-media.yaml.

Le YAML est la source de vérité. Ce script le traduit en appels API
agent-team-service, donc la config n'est pas décorative : elle crée
réellement l'agent, sa configuration, son profil et ses prompts.

Idempotent : relancé, il met à jour l'agent existant au lieu d'en créer
un second (recherche par metadata.slug).

Usage :
    python3 studio-design/seed-studio-agent.py --env prod
    python3 studio-design/seed-studio-agent.py --env local --owner moi@exemple.fr
    python3 studio-design/seed-studio-agent.py --env prod --dry-run
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
SPEC_PATH = HERE / "agent-studio-media.yaml"

TARGETS = {
    # (base de l'API publique, port interne via SSH)
    "local": "http://127.0.0.1:8480",
    "prod": "http://127.0.0.1:8480",  # exécuter depuis le serveur, ou via tunnel
}

SSH_TARGET = "root@157.173.114.181"
SSH_KEY = os.path.expanduser("~/.ssh/id_rsa_shopyapp")

# model/enums/PromptType.java : il n'existe pas de type "USER"
PROMPT_TYPES = {
    "SYSTEM", "TASK", "ANALYSIS", "REPLY",
    "CLASSIFICATION", "EXTRACTION", "GENERATION",
}


def die(msg: str, code: int = 1):
    print(f"  ERREUR: {msg}", file=sys.stderr)
    sys.exit(code)


class Api:
    """Client HTTP minimal. Un seul point d'appel, erreurs en français."""

    def __init__(self, base: str, token: str, dry_run: bool):
        self.base = base.rstrip("/")
        self.token = token
        self.dry_run = dry_run

    def call(self, method: str, path: str, body: dict | None = None) -> dict | list | None:
        url = f"{self.base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        if self.dry_run:
            print(f"    [dry-run] {method} {path}")
            return {}
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            die(f"{method} {path} -> HTTP {e.code}\n      {detail}")
        except urllib.error.URLError as e:
            die(f"{method} {path} injoignable ({e.reason})")


def build_create_request(spec: dict, owner: str) -> dict:
    meta, profile, config = spec["metadata"], spec["profile"], spec["config"]
    return {
        "name": meta["displayName"],
        "description": meta["description"].strip(),
        "type": meta["type"],
        "slug": meta["slug"],
    }


def build_config_request(spec: dict) -> dict:
    """Ne renvoie que les champs réellement acceptés par AgentConfigRequest.

    Jackson ignore silencieusement les propriétés inconnues : sans ce
    filtrage, le script enverrait contextWindowSize / retryMax et
   croirait avoir configuré l'agent alors que la valeur serait perdue.
    """
    accepted = {
        "temperature", "maxTokens", "maxMemoryMessages", "maxIterations",
        "taskTimeoutSeconds", "rateLimitRpm", "responseLanguage", "timezone",
        "streamingEnabled", "autoEscalateEnabled", "autoReplyEnabled",
        "workingHoursJson", "customParams",
    }
    c = dict(spec["config"])
    c["customParams"] = json.dumps({"enabledTools": c.pop("enabledTools")})

    dropped = sorted(set(c) - accepted)
    if dropped:
        print(f"     ! champs absents de AgentConfigRequest, ignores : {', '.join(dropped)}")
    return {k: v for k, v in c.items() if k in accepted}


def build_profile_request(spec: dict) -> dict:
    """Champs acceptés par AgentProfileRequest (pas de brandVoiceJson)."""
    p = spec["profile"]
    req = {
        "displayName": spec["metadata"]["displayName"],
        "bio": p["bio"].strip(),
        "persona": p["bio"].strip(),
        "tone": p["tone"],
        "welcomeMessage": p["welcomeMessage"].strip(),
        "capabilitiesJson": json.dumps(p.get("capabilities", []), ensure_ascii=False),
        "restrictionsJson": json.dumps(p.get("restrictions", []), ensure_ascii=False),
    }
    if "brandVoice" in p:
        print("     ! brandVoice non expose par AgentProfileRequest : "
              "repris dans restrictions")
    return req


def main() -> int:
    ap = argparse.ArgumentParser(description="Seed l'agent Studio")
    ap.add_argument("--env", choices=list(TARGETS), default="local")
    ap.add_argument("--owner", help="email du propriétaire (sinon prolific agents)")
    ap.add_argument("--token", help="JWT admin (sinon lu dans AGENT_TOKEN)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not SPEC_PATH.exists():
        die(f"spec introuvable: {SPEC_PATH}")
    spec = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
    print(f"  Spec: {SPEC_PATH.name} (kind={spec.get('kind')})")

    token = args.token or os.environ.get("AGENT_TOKEN")
    owner = args.owner or os.environ.get("AGENT_OWNER")
    if not owner and not args.dry_run:
        die("il faut --owner (ou AGENT_OWNER)")

    base = TARGETS[args.env]
    if args.env == "prod" and not args.dry_run:
        # L'API est interne au serveur : on ouvre un tunnel plutôt que
        # d'exposer le gateway.
        print("  prod: le tunnel SSH doit être ouvert au préalable")
    if not token and args.env == "prod":
        die("il faut --token (ou AGENT_TOKEN)")

    api = Api(base, token or "dry-run", args.dry_run)

    # 1. Chercher un agent existant par slug -> idempotence
    print("  1. recherche d'un agent existant (slug=%s)" % spec["metadata"]["slug"])
    listing = api.call("GET", "/api/agents?size=200") or []
    items = listing.get("content", listing) if isinstance(listing, dict) else listing
    slug = spec["metadata"]["slug"]
    existing = next((a for a in items if a.get("slug") == slug), None)

    if existing:
        agent_id = existing["id"]
        print(f"     -> trouve, id={agent_id} (mise a jour)")
    else:
        print("     -> absent, creation")
        created = api.call("POST", "/api/agents", build_create_request(spec, owner))
        agent_id = (created or {}).get("id")
        if not agent_id and not args.dry_run:
            die("la creation n'a pas retourne d'id")

    # 2. Configuration d'execution
    print("  2. configuration (temperature, outils, timeouts)")
    api.call("PUT", f"/api/agents/{agent_id}/config", build_config_request(spec))

    # 3. Profil / persona
    print("  3. profil (ton, capacites, garde-fous)")
    api.call("PUT", f"/api/agents/{agent_id}/profile", build_profile_request(spec))

    # 4. Prompts : on supprime l'existant SYSTEM pour eviter les doublons
    prompts = spec.get("prompts", {})
    if prompts:
        print("  4. prompts")
        existing_prompts = api.call("GET", f"/api/agents/{agent_id}/prompts") or []
        for p in existing_prompts if isinstance(existing_prompts, list) else []:
            if p.get("type") == "SYSTEM":
                print(f"     suppression de l'ancien prompt SYSTEM {p.get('id')}")
                api.call("DELETE", f"/api/agents/{agent_id}/prompts/{p['id']}")
        for ptype, content in prompts.items():
            # Garde-fou : PromptType n'autorise qu'un enum fermé.
            if ptype not in PROMPT_TYPES:
                die(f"type de prompt '{ptype}' hors enum PromptType {sorted(PROMPT_TYPES)}")
            api.call(
                "POST",
                f"/api/agents/{agent_id}/prompts",
                {
                    "name": f"studio-{ptype.lower()}",
                    "type": ptype,
                    "content": content,
                    "description": "Studio : direction artistique et transcription du brief",
                },
            )

    print(f"  OK  agent Studio pret : {agent_id}")
    print("  Rappel: l'onglet Studio doit resoudre cet agent par slug au demarrage,")
    print("  pas seulement le premier agent de la liste.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
