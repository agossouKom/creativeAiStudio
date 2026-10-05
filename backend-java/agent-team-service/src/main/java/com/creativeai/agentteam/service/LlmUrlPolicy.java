package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.enums.LlmType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/**
 * Valide l'URL de base d'un provider LLM avant son enregistrement.
 *
 * <p>Le champ {@code baseUrl} est libre par conception (Ollama auto-hébergé,
 * passerelle compatible OpenAI interne), mais un backend qui l'interroge sans
 *restriction est un SSRF : un utilisateur pourrait faire fetcher par le service
 * une adresse interne et lire la réponse via une erreur applicative
 * (« InvalidAccessKeyId », « connection refused »…) qui trahit ce qui est
 * joignable depuis le réseau Docker. Cas classiques : métadonnées cloud
 * ({@code 169.254.169.254}), services non exposés, ports d'administration.
 *
 * <p>Le contrôle porte sur le schéma et l'hôte, pas sur le chemin : c'est ce qui
 * détermine la destination TCP. Un chemin libre est sans danger ici puisque le
 * seul ajout est le suffixe {@code /models}, et l'appel est toujours un GET.
 *
 * <p>Contrôlé à l'enregistrement, pas à chaque appel : les providers déjà en base
 * ne sont pas cassés par ce correctif, et le coût reste nul au runtime.
 */
@Component
public class LlmUrlPolicy {

    /** Hôtes exacts des fournisseurs connus. */
    private static final Set<String> KNOWN_HOSTS = Set.of(
        "api.groq.com",
        "api.openai.com",
        "api.anthropic.com",
        "api.mistral.ai",
        "generativelanguage.googleapis.com",
        "api.cohere.ai",
        "api.together.xyz",
        "api.deepseek.com"
    );

    /** Noms d'hôtes tolérés pour les instances locales/réseau de développement. */
    private static final Set<String> LOCAL_HOSTS = Set.of(
        "localhost",
        "host.docker.internal",
        "ollama",
        "openai"
    );

    /**
     * Vérifie une URL de base et la renvoie normalisée (sans slash final).
     *
     * @param type        fournisseur, utilisé pour autoriser son hôte par défaut
     * @param baseUrl     URL saisie ; {@code null} ou vide signifie « défaut du fournisseur »
     * @return l'URL normalisée, ou {@code null} si aucune n'a été fournie
     * @throws ResponseStatusException 400 si l'URL est inexploitable ou non autorisée
     */
    public String validate(LlmType type, String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return null;
        }
        String candidate = baseUrl.trim();

        URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "URL de base invalide pour le provider LLM");
        }

        String scheme = uri.getScheme() == null ? null : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "L'URL de base doit être en http:// ou https://");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "L'URL de base doit contenir un nom d'hôte");
        }
        host = host.toLowerCase(Locale.ROOT);

        if (!isAllowedHost(host)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Hôte non autorisé pour un provider LLM : " + host
                    + ". Utilisez un fournisseur connu, ou une URL locale "
                    + "(localhost, ollama, host.docker.internal) pour une instance auto-hébergée.");
        }

        return stripTrailingSlash(candidate);
    }

    private boolean isAllowedHost(String host) {
        if (KNOWN_HOSTS.contains(host) || LOCAL_HOSTS.contains(host)) {
            return true;
        }
        // Noms d'hôte DNS arbitraires sont refusés : ils peuvent résoudre vers
        // une IP interne (rebinding) ou vers un service non exposé.
        // Seules les adresses IP littérales loopback sont tolérées, ce qui
        // couvre le cas « Ollama sur 127.0.0.1 ».
        return "127.0.0.1".equals(host) || "::1".equals(host);
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}