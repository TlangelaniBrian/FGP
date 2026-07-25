## [LRN-20260711-001] correction

**Logged**: 2026-07-11T00:00:00+02:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
The Capitec handoff defines functional portal behavior as well as visual design.

### Details
The first implementation focused on the shared visual shell and local seeded
interactions. That does not satisfy the requirement to convert the mock into a
working product with persistent workflows, real API/data boundaries, and
handler-level permissions.

### Suggested Action
Audit every handoff screen against the current database/API surface, add the
missing persistence and route handlers, and verify end-to-end interactions.

### Metadata
- Source: user_feedback
- Related Files: docs/design_handoff_fgp_portal/README.md
- Tags: handoff, functionality, persistence, permissions

---
