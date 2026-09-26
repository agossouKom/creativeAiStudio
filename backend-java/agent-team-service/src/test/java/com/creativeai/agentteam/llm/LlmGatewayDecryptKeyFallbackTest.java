package com.creativeai.agentteam.llm;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import com.creativeai.agentteam.service.EncryptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * decryptKey() ne retombait sur les variables d'environnement que si la cle en
 * base etait vide. Les providers de la prod etaient chiffres avec une autre
 * ENCRYPTION_KEY : la dechiffrement levait "Decryption error" et chaque appel
 * LLM de l'agent echouait en 409, meme avec des variables d'env valides.
 *
 * Ces tests verrouillent le repli, y compris le cas ou le type est errone
 * (DeepSeek enregistre en OPENAI, qu'on retypé via rotate-llm-keys.sh).
 */
class LlmGatewayDecryptKeyFallbackTest {

    private final EncryptionService encryptionService = mock(EncryptionService.class);
    private final LlmGateway gateway = new LlmGateway(
        mock(LlmProviderRepository.class),
        mock(AgentRepository.class),
        mock(AgentTeamRepository.class),
        encryptionService,
        mock(WebClient.Builder.class),
        new ObjectMapper(),
        mock(QuotaTracker.class));

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(gateway, "groqApiKey",    "gsk-env-value");
        ReflectionTestUtils.setField(gateway, "deepseekApiKey", "sk-env-value");
    }

    private String decryptKey(LlmProvider provider) {
        return ReflectionTestUtils.invokeMethod(gateway, "decryptKey", provider);
    }

    private static LlmProvider provider(LlmType type, String encryptedKey) {
        return LlmProvider.builder().type(type).encryptedApiKey(encryptedKey).build();
    }

    @Test
    void usesEnvironmentWhenTheStoredKeyCannotBeDecrypted() {
        when(encryptionService.decrypt(anyString()))
            .thenThrow(new IllegalStateException("Decryption error"));

        assertEquals("sk-env-value", decryptKey(provider(LlmType.DEEPSEEK, "iv:ciphertext")));
        assertEquals("gsk-env-value", decryptKey(provider(LlmType.GROQ,    "iv:ciphertext")));
    }

    @Test
    void usesEnvironmentWhenNoKeyIsStoredAtAll() {
        assertEquals("sk-env-value", decryptKey(provider(LlmType.DEEPSEEK, null)));
        assertEquals("gsk-env-value", decryptKey(provider(LlmType.GROQ,    "  ")));
    }

    @Test
    void keepsTheStoredKeyWhenItDecryptsSuccessfully() {
        when(encryptionService.decrypt("iv:ciphertext")).thenReturn("sk-from-database");

        assertEquals("sk-from-database", decryptKey(provider(LlmType.DEEPSEEK, "iv:ciphertext")));
    }

    @Test
    void propagatesTheFailureForProvidersWithNoEnvironmentFallback() {
        when(encryptionService.decrypt(anyString()))
            .thenThrow(new IllegalStateException("Decryption error"));

        // OPENAI n'a pas de variable d'env : on ne masque pas l'erreur, sinon
        // l'appel partirait avec une cle vide et l'echec deviendrait obscur.
        assertThrows(IllegalStateException.class, () -> decryptKey(provider(LlmType.OPENAI, "iv:ciphertext")));
    }
}
