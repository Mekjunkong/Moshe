# Oracle OS Level 3 Implementation Plan

## Overview
Build Mike's Oracle from Level 1 reactive assistant to Level 3 Oracle OS: proactive reports, unified memory, and dashboard command center.

## Context
- Moshe brain: `/Users/pasuthunjunkong/workspace/Moshe/ψ/`
- Obsidian vault: `/Users/pasuthunjunkong/Documents/MyVault`
- Telegram runtime: Hermes
- Coding runtime: Claude Code + Codex CLI
- Existing dashboard candidate: `/Users/pasuthunjunkong/workspace/Moshe/galaxy/`

## Tasks

### Task 1: Weekly Oracle Report Automation
**File:** Hermes cron job
**Test:** Run cron job once manually

1. Create weekly Monday report job.
2. Prompt must inspect ψ learnings, recent retrospectives, Obsidian project notes, and Wiro notes.
3. Output concise Telegram summary with 3 next actions.
4. Verify job appears in cron list.

### Task 2: Oracle OS Project Notes
**File:** `/Users/pasuthunjunkong/Documents/MyVault/02-Projects/Oracle OS.md`
**Test:** Read note and verify links render as wikilinks

1. Create project note.
2. Link to Moshe and Wiro4x4.
3. Track Level 1/2/3 status.

### Task 3: Data Schema
**File:** `/Users/pasuthunjunkong/workspace/Moshe/oracle-os/schema.md`
**Test:** Schema covers projects, memories, tasks, reports

1. Define Project type.
2. Define MemoryItem type.
3. Define Report type.
4. Define AgentAction type.

### Task 4: Dashboard Prototype
**File:** `/Users/pasuthunjunkong/workspace/Moshe/oracle-os/`
**Test:** Local dev server opens dashboard

1. Decide whether to extend `galaxy/` or create new app.
2. Create dashboard layout.
3. Add project cards.
4. Add weekly recommendations panel.
5. Add memory/recent learnings panel.

### Task 5: Wiro Business Brain Panel
**File:** Oracle OS dashboard module
**Test:** Panel shows Wiro next actions

1. Read Wiro Obsidian notes.
2. Show website status.
3. Show conversion opportunities.
4. Show Hebrew/English marketing ideas.

## Guardrails
- Never expose secrets.
- Never push code without Mike approval.
- Always verify before reporting completion.
- Keep reports short and action-oriented.
