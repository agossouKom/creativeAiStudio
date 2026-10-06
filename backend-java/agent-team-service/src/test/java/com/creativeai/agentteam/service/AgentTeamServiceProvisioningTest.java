package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateTeamRequest;
import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Couvre l'attribution du modèle au moment de la création d'équipe.
 *
 * <p>Le déclencheur est la création de l'équipe, et non celle de son premier
 * agent. Une équipe déjà peuplée n'attendant aucun agent à venir, déclencher
 * l'attribution sur une création d'agent laissait ces équipes sans provider
 * indéfiniment — et sans le moindre signal, l'attribution dépendant d'un appel
 * qui répond 201.
 */
class AgentTeamServiceProvisioningTest {

    private AgentTeamRepository             teamRepo;
    private LlmProviderProvisioningService llmProvisioning;
    private AgentTeamService               service;

    @BeforeEach
    void setUp() {
        teamRepo       = mock(AgentTeamRepository.class);
        llmProvisioning = mock(LlmProviderProvisioningService.class);
        service = new AgentTeamService(teamRepo, llmProvisioning, mock(AuditService.class),
            new ObjectMapper());
    }

    /** Payload minimal : seul le nom est requis par l'API. */
    private static CreateTeamRequest teamRequest() {
        return new CreateTeamRequest("Ventes", null, null, null, null, null,
            null, null, null, null, null, null, null);
    }

    @Test
    @DisplayName("La création d'équipe dépose immédiatement un provider sur l'équipe")
    void provisionsProviderOnTeamCreation() {
        when(teamRepo.save(any(AgentTeam.class))).thenAnswer(inv -> {
            AgentTeam saved = inv.getArgument(0);
            saved.setId("team-1");
            return saved;
        });

        service.createTeam("user@creativeai.com",
            teamRequest());

        verify(llmProvisioning).ensureTeamProviderFromPlatformDefault(eq("team-1"));
    }

    /**
     * L'identifiant doit être celui de l'équipe-recorded. Passer l'entité avant
     * sauvegarde, ou un identifiant vide, produirait une copie orpheline : le
     * provider existerait en base sans équipe propriétaire, donc invisible
     * depuis l'équipe et sans effet au runtime.
     */
    @Test
    @DisplayName("Le provider est déposé sur l'identifiant réellement attribué")
    void provisionsOnPersistedIdentifier() {
        when(teamRepo.save(any(AgentTeam.class))).thenAnswer(inv -> {
            AgentTeam saved = inv.getArgument(0);
            saved.setId("uuid-attribue-par-la-base");
            return saved;
        });

        service.createTeam("user@creativeai.com",
            teamRequest());

        ArgumentCaptor<String> teamId = ArgumentCaptor.forClass(String.class);
        verify(llmProvisioning).ensureTeamProviderFromPlatformDefault(teamId.capture());

        assertThat(teamId.getValue()).isEqualTo("uuid-attribue-par-la-base");
    }

    @Test
    @DisplayName("Aucun appel n'est fait sans identifiant d'équipe")
    void doesNotProvisionWithoutTeamId() {
        when(teamRepo.save(any(AgentTeam.class))).thenAnswer(inv -> inv.getArgument(0));

        service.createTeam("user@creativeai.com",
            teamRequest());

        verify(llmProvisioning, never()).ensureTeamProviderFromPlatformDefault(anyString());
    }

    /**
     * Une équipe qui vient d'être créée ne peut pas déjà avoir de provider :
     * l'appel aurait de toute façon été sans effet. Ce test verrouille surtout
     * que l'attribution automatique ne passe pas par un chemin qui court-
     * circuite le service dédié.
     */
    @Test
    @DisplayName("L'attribution passe bien par le service de provisionnement")
    void delegatesToProvisioningService() {
        when(teamRepo.save(any(AgentTeam.class))).thenAnswer(inv -> inv.getArgument(0));
        when(llmProvisioning.ensureTeamProviderFromPlatformDefault(anyString()))
            .thenReturn(Optional.empty());

        service.createTeam("user@creativeai.com",
            teamRequest());

        verify(llmProvisioning).ensureTeamProviderFromPlatformDefault(any());
    }
}