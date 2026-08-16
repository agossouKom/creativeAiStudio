package com.creativeai.telegram.config;

/**
 * Service interne — pas de Spring Security.
 * Les endpoints MCP (/mcp/sse, /mcp/message) et actuator sont accessibles sans auth.
 */
public class SecurityConfig {
    // intentionnellement vide
}
