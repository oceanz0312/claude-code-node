# Agent-Friendly Docs And DX Design

## Goal

Improve the repository's agent friendliness without changing SDK runtime semantics.

The work focuses on:

- clearer document entry points
- explicit architecture and troubleshooting guidance
- stronger validation workflow for agents
- low-friction scripts for common verification tasks

## Scope

### Documentation

- add a docs index so agents can discover the right document quickly
- add an architecture document covering object boundaries and execution flow
- add a testing and verification document covering expected commands and interpretation
- add an agent playbook covering read order, safe modification flow, and common debugging paths
- update README and AGENTS.md to link these docs and keep terminology aligned with current code

### Developer Experience

- add `check` as a stable validation entry point
- add `test:coverage` for explicit coverage-oriented verification
- add `verify` for a full local release-style validation path

## Non-Goals

- no lint or formatter rollout
- no runtime behavior changes beyond documentation and script exposure
- no changes to exported SDK APIs other than documentation clarity

## Rationale

The evaluation report identified the biggest remaining opportunities in:

- D1: missing explicit architecture documentation
- D2: limited documented troubleshooting and best-practice guidance
- D6: test coverage and validation workflow not clearly documented
- D7: build and verification scripts remain basic

This change set targets those gaps directly while keeping the repository small and legible.
