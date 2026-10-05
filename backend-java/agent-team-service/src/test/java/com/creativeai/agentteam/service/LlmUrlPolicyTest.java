package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.enums.LlmType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Couvre le garde-fou SSRF appliqué aux {@code baseUrl} des providers LLM.
 *
 * <p>Le champ est volontairement libre pour permettre Ollama auto-hébergé ou une
 * passerelle compatible OpenAI. Sans contrôle d'hôte, le backend devient un
 * relais vers le réseau interne : métadonnées cloud, ports d'administration,
 * services non exposés par le réseau Docker. Les réponses d'erreur du
 * fournisseur Suffisent à ensuite deviner ce qui est joignable.
 */
class LlmUrlPolicyTest {

    private final LlmUrlPolicy policy = new LlmUrlPolicy();

    @Test
    @DisplayName("Les URL des fournisseurs connus sont acceptées")
    void acceptsKnownProviderHosts() {
        assertThat(policy.validate(LlmType.GROQ, "https://api.groq.com/openai/v1"))
            .isEqualTo("https://api.groq.com/openai/v1");
        assertThat(policy.validate(LlmType.DEEPSEEK, "https://api.deepseek.com"))
            .isEqualTo("https://api.deepseek.com");
    }

    @Test
    @DisplayName("Une instance locale auto-hébergée reste possible")
    void acceptsLocalSelfHostedInstance() {
        assertThat(policy.validate(LlmType.OLLAMA, "http://localhost:11434/v1"))
            .isEqualTo("http://localhost:11434/v1");
        assertThat(policy.validate(LlmType.OLLAMA, "http://ollama:11434/v1"))
            .isEqualTo("http://ollama:11434/v1");
        assertThat(policy.validate(LlmType.OLLAMA, "http://host.docker.internal:11434/v1"))
            .isEqualTo("http://host.docker.internal:11434/v1");
        assertThat(policy.validate(LlmType.OLLAMA, "http://127.0.0.1:11434/v1"))
            .isEqualTo("http://127.0.0.1:11434/v1");
    }

    @Test
    @DisplayName("Le slash final est retiré pour éviter la double barre en suffixant /models")
    void stripsTrailingSlash() {
        assertThat(policy.validate(LlmType.OPENAI, "https://api.openai.com/v1/"))
            .isEqualTo("https://api.openai.com/v1");
    }

    @Test
    @DisplayName("Aucune URL fournie = URL par défaut du fournisseur, pas d'erreur")
    void blankUrlMeansProviderDefault() {
        assertThat(policy.validate(LlmType.GROQ, null)).isNull();
        assertThat(policy.validate(LlmType.GROQ, "   ")).isNull();
    }

    @Test
    @DisplayName("Les métadonnées cloud sont refusées")
    void rejectsCloudMetadataEndpoint() {
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "http://169.254.169.254/latest/meta-data/"))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("Une IP privée ou un réseau interne sont refusés")
    void rejectsPrivateNetworkTargets() {
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "http://10.0.0.5:8080/v1"))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "http://192.168.1.10/v1"))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "http://postgres:5432"))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Un nom d'hôte arbitraire est refusé : il peut résoudre vers une IP interne")
    void rejectsArbitraryHostname() {
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "https://mon-proxy-interne.attacker.example/v1"))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Un hôte connu mais mal orthographié n'est pas accepté par suffixe")
    void doesNotMatchKnownHostsBySuffix() {
        // api.groq.com.evil.example contient le nom connu mais pointe ailleurs.
        assertThatThrownBy(() -> policy.validate(LlmType.GROQ, "https://api.groq.com.evil.example/v1"))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Les schémas autres que http(s) sont refusés")
    void rejectsNonHttpSchemes() {
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "file:///etc/passwd"))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "gopher://api.groq.com:70/"))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policy.validate(LlmType.OPENAI, "api.groq.com/openai/v1"))
            .isInstanceOf(ResponseStatusException.class);
    }
}