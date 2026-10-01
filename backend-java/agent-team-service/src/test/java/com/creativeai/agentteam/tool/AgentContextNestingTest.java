package com.creativeai.agentteam.tool;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Un contexte d'agent imbriqué ne doit pas détruire celui de l'appelant.
 *
 * <p>L'orchestrateur exécute le LLM sur un {@code boundedElastic} et nettoie
 * le contexte dans un {@code finally}. La délégation imbriquée
 * ({@code chatAsSubAgent}) ré-entre dans ce même flux sur le même thread : un
 * {@code clear()} en fin d'exécution imbriquée effaçait alors le contexte du
 * parent, et {@code isSubAgent()} repassait à faux — les garde-fous
 * d'orchestration se trouvaient ré-ouverts pour la suite de la conversation.
 */
class AgentContextNestingTest {

    @AfterEach
    void tearDown() {
        AgentContext.clear();
    }

    @Test
    void unContexteImbriqueEstRestaureApresRestauration() {
        AgentContext.set("parent-agent", "user-1", "session-1", "task-parent", false);
        AgentContext.ExecutionContext parent = AgentContext.current();

        // Entrée dans le sous-agent : l'orchestrateur imbriqué pose son contexte.
        AgentContext.set("child-agent", "user-1", "session-1", "task-child", true);
        assertTrue(AgentContext.isSubAgent());

        // Sortie du sous-agent : restauration du contexte capturé avant l'entrée.
        AgentContext.restore(AgentContext.current());
        AgentContext.restore(parent);

        assertEquals("parent-agent", AgentContext.current().agentId());
        assertEquals("task-parent", AgentContext.current().taskId());
        assertFalse(AgentContext.isSubAgent(), "le parent ne doit plus se croire sous-agent");
    }

    @Test
    void restaurerUnContexteNulRepartDeZero() {
        AgentContext.set("parent-agent", "user-1", "session-1", "task-parent", false);

        // Le parent n'avait pas de contexte : après la sortie imbriquée, il ne doit
        // pas hériter du contexte du sous-agent.
        AgentContext.restore(null);

        assertNull(AgentContext.current());
        assertFalse(AgentContext.isSubAgent());
        assertThrows(IllegalStateException.class, AgentContext::require);
    }

    /**
     * Le cas réellement dangereux : sans restauration, la délégation imbriquée
     * laissait le parent se croyant sous-agent libre, et inversement. Les deux
     * sens doivent être verrouillés.
     */
    @Test
    void unSousAgentNeLaisseraitPasLeParentSeCrireSousAgentNiLInverse() {
        AgentContext.set("parent-agent", "user-1", "s", "task-parent", false);

        AgentContext.ExecutionContext parent = AgentContext.current();
        AgentContext.set("child-agent", "user-1", "s", "task-child", true);
        AgentContext.ExecutionContext child = AgentContext.current();

        AgentContext.restore(parent);
        assertFalse(AgentContext.isSubAgent());
        assertEquals("parent-agent", AgentContext.current().agentId());

        AgentContext.restore(child);
        assertTrue(AgentContext.isSubAgent());
        assertEquals("child-agent", AgentContext.current().agentId());
    }

    @Test
    void currentEstNullSansContextePose() {
        assertNull(AgentContext.current());
    }
}
