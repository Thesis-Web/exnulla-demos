# ExNulla Demo Blueprint

## Human Agentic Pipeline Trainer (Pre-API Orchestration Lab)

**Slug:** `human-agentic-trainer`\
**Version:** 1.0.0\
**Repository:** `exnulla-demos`\
**Demo Category:** Agent Systems / Orchestration / AI Architecture\
**Maturity Target:** Portfolio-Grade Educational Infrastructure

---

# 1. Executive Summary

The **Human Agentic Pipeline Trainer** is an educational demonstration
that teaches multi-agent orchestration principles using a
human-in-the-loop execution model before transitioning to a fully
automated API-based agent pipeline.

This demo functions as:

> Pre-Calculus for Agentic Systems\
> (Manual orchestration → API orchestration)

Learners experience:

- Role separation\
- Prompt routing\
- Context drift\
- Budget discipline\
- Critic/revision loops\
- Deterministic state tracking

The architecture is intentionally designed so that:

- Human Mode = manual copy/paste transport layer\
- API Mode (Stage 2) = same state machine, automated transport

Only the provider adapter changes.

---

# 2. Educational Thesis

Most API-driven agent frameworks obscure orchestration mechanics behind
abstraction layers.

This demo:

- Makes the pipeline visible.\
- Forces structured reasoning.\
- Exposes role friction.\
- Teaches state discipline.\
- Builds intuition for token economy.

When learners later move to an API implementation, they already
understand:

- Why orchestration matters.\
- How role prompts interact.\
- Where drift originates.\
- Why budget constraints exist.\
- What a supervisor agent actually does.

---

# 3. Required ChatGPT Project Setup (Human Mode)

Each agent role must exist as a separate ChatGPT Project, each with its
own persistent instructions.

Learners create four Projects:

1.  Architect\
2.  Developer\
3.  Critic\
4.  Tester

Each project contains:

- Distinct system-level instructions\
- Persistent behavioral constraints\
- Role-specific formatting requirements\
- Explicit boundary enforcement

---

# 4. Local Orchestration Console (LOC)

The LOC performs:

- Run initialization\
- Prompt generation\
- Routing instructions\
- Transcript logging\
- Drift detection (rule-based v1)\
- Budget estimation\
- Rubric scoring\
- Run artifact export

The LOC never interacts with the ChatGPT UI programmatically.

---

# 5. Run Lifecycle

1.  Initialize run\
2.  Generate prompt + role routing\
3.  Human executes in correct project\
4.  Paste response back into LOC\
5.  State updated and next step generated\
6.  Completion when rubric + acceptance criteria satisfied

---

# 6. State Model

Exported artifact:

runs/`<runId>`{=html}.json

Must contain:

- run metadata\
- roles\
- turns\
- artifacts\
- budgets\
- rubric scores\
- drift flags

---

# 7. Budget Pedagogy

Token estimate approximation:

tokens ≈ characters / 4

LOC tracks:

- Per-turn estimate\
- Cumulative estimate\
- Budget warnings

---

# 8. Upgrade Path (Stage 2)

Provider interface allows:

Human Mode: - Await human-pasted input

API Mode: - Programmatic role execution\

- Budget enforcement\
- Tool execution

State machine remains identical.

---

# 9. Deterministic Requirements

- Dockerized environment\
- TypeScript strict mode\
- Prettier + lint enforced\
- Run artifact stamped with GIT_SHA + RUN_ID\
- Deterministic replay support

---

# 10. Strategic Value

Demonstrates:

- Agent orchestration literacy\
- Systems thinking\
- Budget discipline\
- Upgradeable architecture\
- Deterministic engineering

This demo is an educational infrastructure component, not a toy.
