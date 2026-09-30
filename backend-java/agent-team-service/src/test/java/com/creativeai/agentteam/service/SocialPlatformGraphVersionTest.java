package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * La version de la Graph API est une donnée saisie par l'administrateur, pas un
 * littéral dans le code. Ces tests verrouillent les deux propriétés qui comptent :
 * elle est bien lue depuis {@code extra_config.graphVersion}, et une valeur
 * inexploitable retombe sur une version utilisable au lieu de produire une URL
 * cassée en silence.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SocialPlatformGraphVersionTest {

    @Mock private SocialPlatformRepository repository;
    @Mock private EncryptionService        encryptionService;

    private SocialPlatformConfigService service;

    @BeforeEach
    void setUp() {
        service = new SocialPlatformConfigService(repository, encryptionService);
    }

    private void stubExtraConfig(String json) {
        SocialPlatform sp = new SocialPlatform();
        sp.setId("facebook");
        sp.setExtraConfig(json);
        when(repository.findById("facebook")).thenReturn(Optional.of(sp));
    }

    @Test
    @DisplayName("La version déclarée par l'administrateur est utilisée")
    void versionDeclareeEstUtilisee() {
        stubExtraConfig("{\"graphVersion\":\"v24.0\",\"fbBusinessConfigId\":\"123\"}");

        assertThat(service.resolveGraphVersion("FACEBOOK")).isEqualTo("v24.0");
        assertThat(service.graphBaseUrl("FACEBOOK"))
            .isEqualTo("https://graph.facebook.com/v24.0");
    }

    @Test
    @DisplayName("Une version absente retombe sur la version par défaut")
    void versionAbsenteRetombeSurLeDefaut() {
        stubExtraConfig("{\"fbBusinessConfigId\":\"123\"}");

        assertThat(service.resolveGraphVersion("FACEBOOK"))
            .isEqualTo(SocialPlatformConfigService.DEFAULT_GRAPH_VERSION);
    }

    @Test
    @DisplayName("Un extra_config illisible ne fait pas planter et retombe sur le défaut")
    void extraConfigIllisibleRetombeSurLeDefaut() {
        stubExtraConfig("{ ceci n'est pas du JSON");

        assertThat(service.resolveGraphVersion("FACEBOOK"))
            .isEqualTo(SocialPlatformConfigService.DEFAULT_GRAPH_VERSION);
    }

    @Test
    @DisplayName("Une version malformée est refusée : elle produirait une URL cassée")
    void versionMalformeeEstRefusee() {
        // Un slash suffirait à faire de graph.facebook.com/v24.0/... une route
        // qui n'existe pas, et Meta répond 404 sans explication exploitable.
        for (String version : new String[]{"latest", "v24", "24.0", "v24.0/../v19.0", ""}) {
            stubExtraConfig("{\"graphVersion\":\"" + version + "\"}");
            assertThat(service.resolveGraphVersion("FACEBOOK"))
                .as("version %s doit être rejetée", version)
                .isEqualTo(SocialPlatformConfigService.DEFAULT_GRAPH_VERSION);
        }
    }

    @Test
    @DisplayName("Une plateforme absente en base retombe sur le défaut")
    void plateformeAbsenteRetombeSurLeDefaut() {
        when(repository.findById("facebook")).thenReturn(Optional.empty());

        assertThat(service.graphBaseUrl("FACEBOOK"))
            .isEqualTo("https://graph.facebook.com/" + SocialPlatformConfigService.DEFAULT_GRAPH_VERSION);
    }
}