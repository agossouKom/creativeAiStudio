package com.creativeai.auth.service.agent.tool;

import java.util.Map;

public interface AgentTool {
    String getName();
    String getDescription();
    String execute(String userId, Map<String, Object> params);
}
