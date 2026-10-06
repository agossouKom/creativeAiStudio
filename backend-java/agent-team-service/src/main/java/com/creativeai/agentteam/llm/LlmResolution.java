package com.creativeai.agentteam.llm;

import com.creativeai.agentteam.model.LlmProvider;

/**
 * Provider retenu par la chaîne de résolution, et tier qui l'a fourni.
 *
 * @param provider modèle effectivement retenu
 * @param source   tier d'où il vient, du plus prioritaire au plus générique
 */
public record LlmResolution(LlmProvider provider, LlmSource source) {}