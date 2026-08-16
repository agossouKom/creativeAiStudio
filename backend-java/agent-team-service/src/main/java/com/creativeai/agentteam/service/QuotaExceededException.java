package com.creativeai.agentteam.service;

public class QuotaExceededException extends RuntimeException {

    private final int used;
    private final int limit;
    private final String plan;

    public QuotaExceededException(int used, int limit, String plan) {
        super("Quota dépassé — %d/%d tâches utilisées ce mois (plan %s)".formatted(used, limit, plan));
        this.used  = used;
        this.limit = limit;
        this.plan  = plan;
    }

    public int getUsed()   { return used; }
    public int getLimit()  { return limit; }
    public String getPlan() { return plan; }
}
