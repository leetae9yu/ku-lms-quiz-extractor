# KU LMS Quiz Output UX Plan

## TL;DR
> **Summary**: Replace raw path-oriented result UX with a human-readable plain text export flow and a post-success folder-open action, while keeping JSON as a hidden internal artifact.
> **Deliverables**:
> - Plain text quiz export per extraction
> - Hidden JSON artifact retained under the existing internal directory
> - Folder-open action enabled only after successful extraction
> - Updated extract result contract between backend, main/preload, and renderer
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 4

## Context
### Original Request
- Add a more discoverable post-extraction UX than showing a raw filesystem path.
- Save output in a human-readable structure for building a quiz archive/problem book.
- Keep planning first before implementation.

### Interview Summary
- Human-readable default output format: **plain text**.
- JSON should remain as a **hidden internal artifact**.
- Folder-open action should be **enabled only after successful extraction**.
- Output should be **one file per quiz extraction**, not a cumulative book file.
- Verification should remain **`npm run build` + Electron manual QA**; do not add a new automated test harness in this scope.
- Quiz question count and choice count vary by session; the plan must preserve dynamic extraction behavior.

### Metis Review (gaps addressed)
- Guard against scope creep into cumulative problem-book generation.
- Make acceptance criteria explicitly cover the real saved outputs, not just UI copy changes.
- Treat folder-open as an IPC bridge change, not a renderer-only tweak.
- Keep commit boundaries atomic around backend/output work and UI/IPC work.

## Work Objectives
### Core Objective
Ship a minimal UX update that stores a readable plain text export for each quiz, keeps JSON in the internal app data folder, and lets users open the containing folder after a successful extraction.

### Deliverables
- Updated serialization flow that writes both:
  - human-readable `.txt`
  - hidden internal `.json`
- Updated extract result payload returned from backend to renderer
- New folder-open bridge from renderer → preload → Electron main
- UI success state that exposes a folder-open action instead of raw path text

### Definition of Done (verifiable conditions with commands)
- `npm run build` exits `0` in `/root/projects/ku-lms-quiz-app`.
- A successful extraction writes a `.txt` file under the app extracts directory and also retains a `.json` artifact.
- The renderer no longer exposes the raw output path as the primary success message.
- The folder-open action is disabled before success and available after success.
- Manual Electron QA confirms the success state and folder-open action wiring.

### Must Have
- Plain text output shaped for human reading:
  - quiz title/header when available
  - question text
  - all discovered choices in rendered order
  - explicit correct answer marker
  - explanation/comment when present
- One output file per extraction.
- Hidden JSON retention in the existing internal storage area.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No cumulative “master problem book” file.
- No web deployment work.
- No test harness/framework setup.
- No login-flow redesign.
- No changes to extraction semantics for fixed numbers of questions/choices.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **none (no new framework)**; verification uses `npm run build` plus Electron manual QA automation.
- QA policy: Every task includes agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: output model + backend contract + helper naming
Wave 2: IPC folder-open bridge + renderer success-state UX

### Dependency Matrix (full, all tasks)
- Task 1 blocks Task 2.
- Task 2 blocks Task 4.
- Task 3 blocks Task 4.
- Task 4 blocks final verification wave.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → quick / unspecified-low
- Wave 2 → 2 tasks → quick / visual-engineering
- Final Verification → 4 review tasks in parallel

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Add plain text export helpers and naming rules

  **What to do**: Extend the quiz formatting layer so it can generate the human-readable plain text export. Keep output naming one-file-per-quiz and preserve current dynamic handling of variable question/choice counts. Decide the text structure explicitly: title block if available, blank line, per-question heading, choices in discovered order, `정답:` line, `해설:` line when present.
  **Must NOT do**: Do not remove JSON support. Do not introduce cumulative append behavior. Do not assume 4 choices.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: isolated logic change in one helper layer
  - Skills: `[]` — no special skill required
  - Omitted: `frontend-ui-ux` — not a renderer task

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/lib/canvas-quiz.ts:7-44` — extraction data model already carries quiz/question/answer/comment metadata
  - Pattern: `src/lib/canvas-quiz.ts:222-240` — current output naming helper and extension handling
  - Pattern: `src/lib/canvas-quiz.ts:46-81` — whitespace normalization behavior should be preserved for human-readable text too

  **Acceptance Criteria** (agent-executable only):
  - [ ] `src/lib/canvas-quiz.ts` exposes a plain text formatter/helper that uses dynamic question/answer arrays without fixed counts.
  - [ ] Human-readable output structure includes question text, choices, correct answer marker, and explanation when present.
  - [ ] Output naming still resolves one file per extraction under the extracts directory.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Plain text formatting preserves variable counts
    Tool: Bash
    Steps: Run a node smoke script importing the built formatter with a synthetic extraction containing 2 questions and uneven choice counts (e.g. 3 and 5).
    Expected: Output text contains all discovered questions/choices in order and includes explicit 정답 / 해설 labels.
    Evidence: .sisyphus/evidence/task-1-plain-text-format.txt

  Scenario: Missing explanation is handled cleanly
    Tool: Bash
    Steps: Run the same smoke path with one answer/comment absent.
    Expected: Plain text omits the 해설 line for that item without breaking layout.
    Evidence: .sisyphus/evidence/task-1-plain-text-format-edge.txt
  ```

  **Commit**: YES | Message: `feat(output): add plain text quiz export format` | Files: [`src/lib/canvas-quiz.ts`]

- [ ] 2. Update backend extract flow to write hidden JSON + visible plain text

  **What to do**: Change the extraction workflow so JSON remains stored internally, but the primary human-facing artifact becomes the plain text file. Update the return contract from `extractQuiz()` so the UI receives only the data it needs for success state and folder opening, not a raw path string intended for direct display.
  **Must NOT do**: Do not stop writing JSON. Do not change login flow. Do not write outside the existing app workspace.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: localized backend contract/output change
  - Skills: `[]` — no special skill required
  - Omitted: `visual-engineering` — no UI work here

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [4] | Blocked By: [1]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/backend.ts:84-86` — current serialization path is JSON-only
  - Pattern: `src/backend.ts:88-130` — extract flow owns auth checks, parsing, file writing, and result payload
  - Pattern: `src/lib/canvas-quiz.ts:218-240` — use existing workspace/path helpers rather than inventing new storage locations
  - API/Type: `src/backend.ts:23-31` — update `ExtractResult`/backend option contracts here rather than smuggling fields through `any`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `extractQuiz()` writes both `.txt` and `.json` artifacts into the existing extracts/internal storage structure.
  - [ ] JSON remains stored without becoming the primary user-facing file.
  - [ ] Backend returns enough information for the UI to enable folder-open without requiring raw-path status text.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Successful extract writes both artifacts
    Tool: Bash
    Steps: Run a node-level integration smoke script against the backend output helpers or a controlled extraction fixture and inspect the resulting files under the workspace output directory.
    Expected: One plain text file and one JSON file are created for the extraction.
    Evidence: .sisyphus/evidence/task-2-dual-output.txt

  Scenario: Existing missing-session error remains intact
    Tool: Bash
    Steps: Run the Electron or backend extraction path without a saved storage-state.json.
    Expected: The user-facing error still indicates that LMS login is required first.
    Evidence: .sisyphus/evidence/task-2-missing-session.txt
  ```

  **Commit**: YES | Message: `feat(output): save text export alongside internal json` | Files: [`src/backend.ts`, `src/lib/canvas-quiz.ts`]

- [ ] 3. Add a folder-open IPC action scoped to the extracts directory

  **What to do**: Add a new Electron main/preload bridge that opens the extracts folder for the current app workspace. The action must target the folder, not a single file path string. Keep the renderer API narrow and match existing `login`/`extract` bridging style.
  **Must NOT do**: Do not expose unrestricted shell access to the renderer. Do not let the renderer supply arbitrary filesystem paths.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: small Electron bridge addition
  - Skills: `[]` — no special skill required
  - Omitted: `deep` — no architecture expansion required

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [4] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/main.ts:40-42` — current IPC handlers for `quiz:login` and `quiz:extract`
  - Pattern: `src/preload.ts:3-8` — current `window.quizApp` bridge style and return typing
  - Pattern: `src/main.ts:11-13` — app workspace root resolution; folder-open must derive from this, not the renderer
  - API/Type: `src/lib/canvas-quiz.ts:218-240` — existing extract directory naming helpers

  **Acceptance Criteria** (agent-executable only):
  - [ ] A new renderer-safe API exists for opening the extracts folder.
  - [ ] The main process computes the target folder internally from the app workspace.
  - [ ] Renderer cannot request arbitrary path opening.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Folder-open IPC is callable after boot
    Tool: Bash
    Steps: Launch the Electron app in automated mode and invoke the new preload API from the renderer context.
    Expected: The call resolves without exposing raw Node/Electron modules to the renderer.
    Evidence: .sisyphus/evidence/task-3-folder-ipc.txt

  Scenario: Arbitrary path injection is impossible
    Tool: Bash
    Steps: Inspect the preload/main bridge contract and attempt to call the API with a fabricated path argument if one exists.
    Expected: No arbitrary renderer-supplied path is accepted.
    Evidence: .sisyphus/evidence/task-3-folder-ipc-edge.txt
  ```

  **Commit**: YES | Message: `feat(app): add extracts folder open action` | Files: [`src/main.ts`, `src/preload.ts`, `src/lib/canvas-quiz.ts`]

- [ ] 4. Replace raw path success UX with plain text success state + folder-open button

  **What to do**: Update the inline renderer so extraction success no longer prints the raw output path as the main success copy. Add a `폴더 열기` control that is disabled or hidden until a successful extraction completes, then enables for the current session. Keep the page otherwise minimal and consistent with the existing centered layout.
  **Must NOT do**: Do not add extra settings, file pickers, history lists, or cumulative-book UI. Do not make the folder-open action available before any successful extraction.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: renderer-state and UI control change
  - Skills: `[]` — keep plain inline UI style
  - Omitted: `artistry` — no redesign beyond minimal UX update

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [] | Blocked By: [2, 3]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/ui.ts:104-120` — current visible control set and minimal centered layout
  - Pattern: `src/ui.ts:157-210` — current login/extract event flow and success/error status updates
  - Pattern: `src/preload.ts:3-8` — renderer API surface to extend
  - API/Type: `src/backend.ts:23-26` — extract result shape currently returned to UI

  **Acceptance Criteria** (agent-executable only):
  - [ ] Before extraction success, the renderer does not present an active folder-open control.
  - [ ] After extraction success, the renderer presents an enabled `폴더 열기` action.
  - [ ] Success copy no longer depends on showing a raw filesystem path string to the user.
  - [ ] Existing empty-URL and missing-session error messaging still works.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Folder-open control is gated by success state
    Tool: Bash
    Steps: Launch the Electron app with Playwright Electron automation; inspect initial UI state, trigger empty extract, then seed a prepared extraction-success state by invoking the built renderer/backend contract with a deterministic fake result object from an isolated test seam added for QA or by using a temporary app workspace containing a prewritten successful extract result contract consumed by the renderer.
    Expected: Folder-open is unavailable before success and available after success.
    Evidence: .sisyphus/evidence/task-4-folder-button.txt

  Scenario: Error states still read cleanly
    Tool: Bash
    Steps: Trigger empty URL and missing-session paths after the UI update.
    Expected: Status text remains user-readable and no raw IPC error prefix leaks through.
    Evidence: .sisyphus/evidence/task-4-error-states.txt
  ```

  **Commit**: YES | Message: `feat(ui): replace raw path text with folder-open action` | Files: [`src/ui.ts`, `src/preload.ts`, `src/main.ts`, `src/backend.ts`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
  - Tool: `task(subagent_type="oracle", ...)`
  - Steps: Read the final changed files, compare implementation against every plan task + Must Have/Must NOT Have list, and verify nothing outside scope was added.
  - Expected: Oracle confirms all planned deliverables landed and no forbidden scope creep exists.
- [ ] F2. Code Quality Review — unspecified-high
  - Tool: `task(category="unspecified-high", ...)`
  - Steps: Review changed source for code quality, contract consistency, error handling, and maintainability.
  - Expected: Reviewer finds no blocking code-quality defects.
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
  - Tool: `task(category="unspecified-high", ...)` plus Playwright Electron automation
  - Steps: Run `npm run build`, launch the Electron app, verify initial disabled/hidden folder-open state, verify empty-URL error, verify missing-session error, and verify success-state folder-open availability using the deterministic prepared success path defined in Task 4.
  - Expected: All user-visible states behave exactly as planned.
- [ ] F4. Scope Fidelity Check — deep
  - Tool: `task(category="deep", ...)`
  - Steps: Review the diff and confirm the work stayed within the agreed scope: plain text export, hidden JSON, folder-open action, no cumulative book, no web deployment, no test harness expansion.
  - Expected: Deep reviewer confirms feature fidelity to the agreed product slice.

## Commit Strategy
- Commit after Task 1 if the formatter layer is cleanly isolated.
- Commit after Task 2 when output writing and contract changes are stable.
- Commit after Task 3 only if the IPC bridge can stand alone cleanly; otherwise combine with Task 4.
- Final feature commit after Task 4 if UI/IPC/backend were adjusted together.

## Success Criteria
- The app stores a plain text quiz export per extraction.
- JSON remains present internally without being the main user-facing artifact.
- Users can open the extract folder from the app after successful extraction.
- The renderer no longer asks users to manually navigate a long internal path.
- Build and manual Electron QA pass without introducing new test infrastructure or unrelated UX scope.
