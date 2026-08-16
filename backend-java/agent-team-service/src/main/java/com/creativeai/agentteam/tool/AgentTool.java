package com.creativeai.agentteam.tool;

import java.util.Map;

public interface AgentTool {
    String getName();
    String getDescription();
    String getParametersSchema();
    String execute(String agentId, String userId, Map<String, Object> params);
    default boolean isEnabled() { return true; }
}
