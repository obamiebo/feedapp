# Project Agent Guidelines

These instructions guide future development sessions in this repository.

## Product Quality Bar

This platform is an industry-grade internal operations system. Engineering decisions must treat staff UX as part of system quality, not as a secondary polish step.

## SSR and UX Tradeoffs

- Prefer server-side rendering, server actions, and URL-driven state when they improve correctness, performance, shareability, or reload persistence.
- Do not use server navigation for UI-only interactions if it creates avoidable page jumps, repeated scrolling, lost context, or unnecessary refresh behavior.
- Use client components for transient interface state such as tabs, segmented filters, expanded panels, modal state, inline editing state, selected rows, and local workflow steps.
- Use URL query params for state that should be bookmarkable, shareable, restorable after reload, or meaningful outside the current screen session.
- Preserve user context in operational workflows, including scroll position, selected tabs, active filters, in-progress edits, and the section the user was working in after saves.
- When a form save must round-trip to the server, redirect back to the relevant workflow location with enough state to keep the user oriented.

## Customer-Centric Workflow UX

- Case-management screens should make staff actions feel continuous and low-friction.
- Avoid adding timeline or workflow events for drafts, suggestions, or internal system prompts unless they represent something that actually happened on the case.
- Customer-facing message suggestions should be easy for authorized case users to review, edit, send, or decline without requiring platform-admin approval.
- Messaging and stale-case prompts should support timely, thoughtful customer updates without overwhelming reps or sending duplicate stage-based messages.
