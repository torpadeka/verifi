// Per-stage model routing. Verifi deliberately spreads work across BTL's model
// catalog: a cheap, fast vision model drives the high-volume browser loop, while
// planning and failure-analysis can be pointed at stronger reasoning models.
// All overridable via env so a demo can dial quality up without code changes.

export const MODELS = {
  planner: process.env.VERIFI_PLANNER_MODEL || "gpt-4o-mini",
  agent: process.env.VERIFI_AGENT_MODEL || "gpt-4o-mini",
  analyst: process.env.VERIFI_ANALYST_MODEL || "gpt-4o-mini",
};
