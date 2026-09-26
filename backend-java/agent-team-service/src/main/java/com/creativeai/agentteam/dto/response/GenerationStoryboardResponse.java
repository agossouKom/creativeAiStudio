package com.creativeai.agentteam.dto.response;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public record GenerationStoryboardResponse(List<JsonNode> storyboards) {}
