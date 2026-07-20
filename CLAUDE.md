# CLAUDE.md — Strict Code Change and Architecture Control Rules

## 0. HIGHEST-PRIORITY RULE: DETECT EXTERNAL CHANGES BEFORE EDITING

This project is being developed by multiple people and multiple AI development tools.

The codebase may have changed since:

* the previous conversation,
* the previous task,
* your last code analysis,
* your last implementation,
* or the user's last instruction.

**Never assume that your previous understanding of the codebase is still current.**

Before modifying any existing file, inspect the current code and compare it with the structure and behavior you previously understood.

If you detect code that appears to have been added, removed, rewritten, moved, renamed, or structurally changed by another person or tool:

1. **Stop before editing the affected code.**
2. Clearly tell the user what changed.
3. Identify the affected files, functions, components, routes, schemas, or dependencies.
4. Explain why the detected change matters.
5. Explain how it may conflict with the current request or your planned implementation.
6. Present specific integration options.
7. Ask the user how the detected changes should be handled before continuing.

Do not silently overwrite, revert, merge, reinterpret, or discard another person's changes.

Do not assume that newer code is correct.

Do not assume that your previous version is correct.

Do not resolve conflicting implementations based only on your own preference.

Use this reporting format:

```text
External changes detected

Affected files:
- path/to/file
- path/to/another-file

What changed:
- Clear description of the detected change

Why this matters:
- Effect on architecture, behavior, data flow, or the requested task

Possible actions:
1. Keep the new implementation and adapt the requested work to it
2. Restore the previous implementation
3. Merge selected parts of both implementations
4. Review the conflicting code before deciding

Please confirm which option should be applied.
```

This rule overrides all instructions to proceed immediately, minimize questions, or complete the task without confirmation.

However, do not stop for harmless differences such as formatting, comments, generated metadata, or unrelated content. Stop only when the change may affect behavior, architecture, data, dependencies, or the requested implementation.

---

# 1. CORE OPERATING PRINCIPLE

Do not merely make the requested feature work.

Make the requested change without increasing structural complexity, duplication, ambiguity, or maintenance cost.

You must protect the integrity of the codebase.

You must not:

* copy an existing bad pattern,
* add another workaround to an existing workaround,
* create duplicate implementations,
* hide errors,
* bypass the intended data flow,
* or make unrelated changes without a clear reason.

If the existing implementation is structurally poor, do not extend it blindly.

Perform the smallest necessary refactor required to add the requested feature safely.

---

# 2. INSPECT BEFORE YOU EDIT

Before writing or modifying code, inspect the current implementation.

You must identify:

* the feature entry point,
* related routes and pages,
* imported components,
* shared components,
* state ownership,
* API request locations,
* database access locations,
* validation logic,
* business rules,
* shared types and interfaces,
* utility functions,
* environment variables,
* configuration files,
* related tests,
* and similar existing implementations.

Do not create a new function, component, service, hook, utility, type, or API client until you have searched for an existing equivalent.

Do not rely only on filenames. Search by behavior, imported symbols, endpoint names, UI text, data fields, and domain terminology.

---

# 3. VERIFY THE CURRENT CODEBASE STATE

At the beginning of every task, treat the repository as an unfamiliar and potentially changed codebase.

Verify:

* whether files have changed since your last task,
* whether new files were added,
* whether existing files were moved or renamed,
* whether dependencies changed,
* whether routes changed,
* whether database schemas changed,
* whether environment variables changed,
* whether duplicated implementations now exist,
* and whether another implementation already addresses the request.

Do not apply an old plan to a changed codebase.

Do not regenerate code from memory when the current file can be inspected.

The repository is the current source of truth, but not every implementation inside it should be assumed to be correct.

---

# 4. PRESENT A CHANGE PLAN BEFORE IMPLEMENTATION

Before making non-trivial changes, provide a concise implementation plan.

Include:

```text
Current structure:
- Relevant existing implementation

Root issue:
- Actual cause of the problem

Files to modify:
- Exact file paths

Files to create:
- Exact file paths and why they are necessary

Code to reuse:
- Existing functions, components, types, or services

Code to remove or consolidate:
- Duplicate, obsolete, or conflicting code

Potential impact:
- Existing behavior that may be affected

Validation:
- Tests, type checks, builds, and manual checks to perform
```

Do not begin a broad multi-file change without first establishing this plan.

Small, isolated, low-risk edits may proceed without a long explanation, but the relevant code must still be inspected first.

---

# 5. DO NOT EXPAND SPAGHETTI CODE

If existing code contains tangled responsibilities, repeated conditions, duplicated logic, or unclear data flow, do not add more logic to the same structure by default.

Do not say:

> The existing code already works this way, so I followed the same pattern.

A bad pattern does not become acceptable because it already exists.

When the requested work touches spaghetti code:

1. Identify the specific structural problem.
2. Determine the minimum safe refactoring boundary.
3. Refactor only the directly affected area.
4. Preserve existing behavior.
5. Add the requested feature through the cleaned structure.
6. Remove code made obsolete by the change.
7. Validate all affected paths.

Do not rewrite the entire application unless the user explicitly requests it.

---

# 6. KEEP RESPONSIBILITIES SEPARATE

A single file, component, or function must not unnecessarily combine:

* rendering,
* state management,
* API requests,
* database access,
* data transformation,
* business rules,
* validation,
* authorization,
* persistence,
* analytics,
* and error reporting.

Separate responsibilities when they are independently reusable, testable, or changeable.

Do not split code into many tiny files without a clear architectural reason.

The goal is clear responsibility, not maximum file count.

---

# 7. FUNCTION RULES

Each function must have one clear purpose.

Refactor a function when it:

* performs unrelated operations,
* contains deeply nested conditions,
* changes several independent states,
* returns inconsistent result shapes,
* depends heavily on hidden external state,
* duplicates logic from another function,
* or cannot be clearly named.

Avoid meaningless names such as:

* `handleData`
* `processAll`
* `doSomething`
* `runLogic`
* `tempFix`
* `newHandler`
* `finalFunction`
* `fixIssue`
* `helper2`

Use names that describe the actual responsibility, such as:

* `validateParticipantRegistration`
* `fetchEventAttendance`
* `calculateCheckInCount`
* `normalizeParticipantRecord`
* `authorizeEventManager`

Do not use comments to compensate for unclear function names or unclear structure.

---

# 8. COMPONENT RULES

Before creating a component, search for an existing component with the same responsibility.

Prefer extending or composing an existing component when appropriate.

Do not create near-duplicate components because modifying the existing one appears inconvenient.

Do not place all of the following inside one page component:

* API calls,
* data transformation,
* form validation,
* business rules,
* loading state,
* permissions,
* and complete UI rendering.

Use the project's existing component hierarchy and design system.

Do not introduce a second UI pattern when the project already has an established one.

Do not duplicate visual elements with slightly different names.

---

# 9. DUPLICATION IS A DEFECT

Before implementing new logic, search for similar logic across the project.

Check for duplication in:

* API calls,
* validation,
* formatting,
* error handling,
* permission checks,
* state transitions,
* data transformation,
* constants,
* types,
* schemas,
* and UI components.

When meaningful duplication exists, reuse or consolidate it.

Do not copy code and change a few lines.

Do not create a generic abstraction before real duplication exists.

Do not merge unrelated business rules into one overly configurable function merely to reduce line count.

---

# 10. DO NOT PATCH SYMPTOMS

Do not add conditional exceptions simply to make one reported case pass.

Before fixing a bug, identify:

* the expected behavior,
* the actual behavior,
* the first point where they diverge,
* the responsible state or data transformation,
* and the root cause.

Forbidden symptom patches include:

* adding repeated null checks without fixing invalid state,
* hardcoding a specific user, identifier, route, date, or value,
* adding another boolean to bypass broken logic,
* introducing an alternate execution path around the real flow,
* swallowing an exception,
* retrying indefinitely,
* or returning an empty object to prevent a crash.

Fix the source of the invalid state or behavior.

---

# 11. CONTROL THE CHANGE SCOPE

Modify only what is necessary for the requested task.

Do not make unrelated changes such as:

* redesigning unrelated pages,
* renaming large parts of the codebase,
* replacing the framework,
* replacing state management,
* changing the database architecture,
* restructuring all routes,
* reformatting the entire project,
* upgrading unrelated packages,
* or refactoring unrelated modules.

If a larger change is genuinely required, explain why before implementing it.

Minimal change does not mean adding the smallest possible patch.

It means making the smallest complete and structurally correct change.

---

# 12. DO NOT OVERWRITE WHOLE FILES UNNECESSARILY

When only a small section requires modification, edit only that section.

Do not regenerate an entire file merely because it is easier.

Full-file replacement can:

* delete another developer's work,
* remove comments and edge-case handling,
* create unnecessary merge conflicts,
* increase review difficulty,
* and consume unnecessary context and tokens.

Preserve unaffected code.

Before replacing a file, confirm that a full rewrite is technically necessary.

---

# 13. TOKEN AND CONTEXT CONTROL

Do not read the entire repository for every task.

Narrow the search in this order:

1. Search for the requested feature or error.
2. Find the route, page, component, or service responsible.
3. Trace its imports and direct dependencies.
4. Inspect related types, schemas, and tests.
5. Expand the search only when necessary.

Do not inspect or output irrelevant generated content such as:

* `node_modules`,
* `.next`,
* `dist`,
* `build`,
* cache directories,
* coverage output,
* binary files,
* media assets,
* large logs,
* database dumps,
* generated bundles,
* and complete lockfiles unless dependency resolution requires it.

Do not repeatedly reread files already inspected during the same task unless they changed.

Do not repeatedly restate the same architectural analysis.

Maintain a concise working summary of confirmed facts.

---

# 14. TYPE SAFETY IS REQUIRED

Do not use `any` to silence type errors.

Do not weaken types merely to make compilation succeed.

Prefer:

* explicit domain types,
* shared interfaces,
* discriminated unions,
* `unknown` with type guards,
* schema validation,
* and precise return types.

Do not define the same data structure independently in multiple files.

Use a single source of truth for shared types.

If `any` is genuinely unavoidable, limit its scope and explain:

* why it is necessary,
* where it is used,
* and how it should eventually be removed.

---

# 15. KEEP DATA TRANSFORMATION CONSISTENT

Do not transform the same API response differently in multiple components.

Normalize external data in a consistent layer.

Do not mix raw API data, normalized domain data, and UI display data without clear boundaries.

Do not change a shared data shape without checking every consumer.

If a schema or type changes, search for all references before editing.

---

# 16. API AND SERVICE RULES

Do not scatter direct API calls across UI components if the project already uses a service or client layer.

Before creating a new request, check for:

* an existing API client,
* an existing endpoint wrapper,
* shared authentication handling,
* error normalization,
* caching behavior,
* retry behavior,
* and response types.

Do not call the same endpoint through multiple inconsistent implementations.

Do not hardcode URLs, secrets, tokens, account IDs, or environment-specific values.

Use existing environment and configuration patterns.

---

# 17. STATE MANAGEMENT RULES

Do not create duplicate sources of truth.

Before introducing new state, identify:

* who owns the state,
* who reads it,
* who changes it,
* whether it is local, shared, server, cached, or persisted state,
* and whether an existing source already represents it.

Do not synchronize two copies of the same state through effects unless unavoidable.

Do not add state for values that can be derived safely from existing state.

Do not use global state for data that belongs to one component.

Do not use local state for data that must remain consistent across the application.

---

# 18. ERROR HANDLING RULES

Never hide errors.

Forbidden examples:

```ts
try {
  await executeTask();
} catch {
  // Ignore
}
```

```ts
// @ts-ignore
```

```ts
// eslint-disable-next-line
```

```ts
const result = response || {};
```

Do not suppress type, lint, or runtime errors without resolving or documenting the cause.

Distinguish between:

* user-facing errors,
* validation errors,
* authorization errors,
* network errors,
* recoverable errors,
* and developer-facing failures.

Provide useful context in errors without exposing sensitive information.

---

# 19. DEPENDENCY CONTROL

Do not install a package before checking whether:

* the project already contains an equivalent dependency,
* the existing framework provides the feature,
* a small local implementation is sufficient,
* the package is actively maintained,
* the package is compatible,
* and the package introduces unnecessary bundle or security cost.

Do not install a large library for a minor utility.

Before adding a dependency, state:

* why it is needed,
* where it will be used,
* why existing dependencies are insufficient,
* and what alternatives were considered.

Do not update unrelated dependencies.

---

# 20. REMOVE OBSOLETE CODE

When a new implementation replaces existing code, remove code that is no longer used.

Check for:

* unused imports,
* unused functions,
* unused components,
* unused types,
* unused styles,
* unused API wrappers,
* obsolete routes,
* temporary logging,
* commented-out legacy code,
* backup files,
* and unused packages.

Do not delete code based on assumption.

Search all static and dynamic references first.

Be especially careful with dynamically imported modules, route conventions, configuration-based loading, and reflection.

---

# 21. DO NOT CREATE VERSION-SUFFIX FILES

Do not create files or symbols named with suffixes such as:

* `new`
* `old`
* `final`
* `final2`
* `copy`
* `backup`
* `v2`
* `latest`
* `fixed`
* `temp`

Examples of prohibited names:

* `DashboardNew.tsx`
* `authServiceV2.ts`
* `finalHandler.ts`
* `UserCardCopy.tsx`
* `api-fixed.ts`

If an implementation replaces another, update the correct implementation and remove the obsolete one after verifying references.

If two versions must coexist for a valid product reason, name them by their actual role, not by chronology.

---

# 22. COMMENTS MUST EXPLAIN WHY

Do not write comments that merely restate the code.

Bad:

```ts
// Set the user name
setUserName(name);
```

Write comments only when they explain:

* a non-obvious design decision,
* an external system limitation,
* a business rule,
* a compatibility requirement,
* a security concern,
* or why a seemingly simpler implementation is unsafe.

Temporary code must include a clear reason and removal condition.

Do not leave vague TODO comments.

---

# 23. VALIDATE EVERY CHANGE

After implementation, run every validation available and relevant to the project.

At minimum, consider:

* type checking,
* linting,
* formatting checks,
* unit tests,
* integration tests,
* build verification,
* route verification,
* database migration validation,
* and manual behavior checks.

Validate:

* the requested behavior,
* existing related behavior,
* empty states,
* invalid input,
* loading states,
* error states,
* permissions,
* mobile layout,
* desktop layout,
* and relevant accessibility behavior.

Do not claim that something was tested unless it was actually tested.

If validation cannot be performed, state exactly:

* what was not tested,
* why it could not be tested,
* and how the user should verify it.

---

# 24. REQUIRED COMPLETION REPORT

After completing the work, report using this format:

```text
Change objective
- What problem was solved

Files modified
- path/to/file: exact change
- path/to/file: exact change

Files created
- path/to/file: reason for creation

Files removed
- path/to/file: reason for removal

Existing code reused
- Components, functions, types, or services reused

Structural decisions
- Why this implementation was selected

External changes handled
- Any changes from other developers that were preserved, merged, or excluded

Validation performed
- Type check:
- Lint:
- Tests:
- Build:
- Manual verification:

Known risks or follow-up items
- Only unresolved items that genuinely remain
```

Keep the report factual.

Do not include validation steps that were not performed.

---

# 25. STOP CONDITIONS

Stop and ask the user before continuing when:

* another developer's changes conflict with the requested task,
* two different implementations provide the same feature,
* it is unclear which implementation is active,
* a database migration is required,
* data could be lost,
* authentication or authorization behavior may change,
* public API contracts may break,
* a major dependency must be replaced,
* the requested change requires a broad architectural rewrite,
* or preserving existing behavior is not possible without a product decision.

When stopping, explain the concrete conflict and provide specific options.

Do not ask broad or vague questions such as:

> What would you like me to do?

Ask a decision-focused question such as:

> The current branch contains two participant validation flows. The new flow in `src/services/registration.ts` rejects incomplete records, while the older flow in `src/pages/register.tsx` allows partial drafts. Should I preserve draft registration, enforce strict validation everywhere, or merge the two behaviors by validating only on final submission?

---

# 26. NON-NEGOTIABLE PROHIBITIONS

Never:

* edit before inspecting the current code,
* assume the repository is unchanged,
* silently overwrite another developer's work,
* silently revert unfamiliar code,
* extend a known bad architecture,
* duplicate an existing feature,
* create parallel API clients,
* create parallel sources of truth,
* patch symptoms with hardcoded conditions,
* hide exceptions,
* use `any` to avoid proper typing,
* disable lint or type checks without a documented technical reason,
* install unnecessary packages,
* replace entire files for small changes,
* perform unrelated refactors,
* delete code without checking references,
* claim unperformed tests,
* or report success when validation failed.

---

# 27. DECISION PRIORITY

When several implementation choices are possible, use this priority order:

1. Protect user data and existing behavior.
2. Detect and preserve intentional external changes.
3. Satisfy the explicit requirement.
4. Maintain one source of truth.
5. Preserve architectural consistency.
6. Eliminate duplication.
7. Keep responsibilities separate.
8. Maintain type safety.
9. Keep the implementation testable.
10. Minimize the correct change scope.
11. Reduce token and context waste.
12. Optimize implementation speed.

Speed is never a valid reason to create structural debt.

---

# 28. EXECUTION SEQUENCE FOR EVERY TASK

For every development request, follow this exact sequence:

1. Inspect the current repository state.
2. Detect changes made since your previous understanding.
3. Stop and report any relevant external changes.
4. Search for existing implementations.
5. Trace the relevant data and control flow.
6. Identify the root cause or required extension point.
7. Present the change plan.
8. Modify only the necessary code.
9. Remove newly obsolete code.
10. Run validation.
11. Review the final diff for unrelated changes.
12. Report the result using the required completion format.

Do not skip steps because the requested change appears simple.

A simple request can still damage a codebase when multiple people and AI tools are editing it.
