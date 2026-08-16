package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.tool.AgentTool;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Component
public class GetCurrentDateTool implements AgentTool {
    @Override public String getName()             { return "get_current_date"; }
    @Override public String getDescription()      { return "Retourne la date et l'heure courante"; }
    @Override public String getParametersSchema() { return "{}"; }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> p) {
        return "{\"datetime\":\"" + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + "\"}";
    }
}
