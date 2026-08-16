package com.creativeai.auth.dto.agent;
public record ScheduledTaskRequest(String name, String prompt, String cronExpression, String runAt) {}
