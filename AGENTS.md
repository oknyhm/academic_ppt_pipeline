# AGENTS.md

## Project purpose

This repository builds reproducible academic PowerPoint presentations from structured content and research assets.

The pipeline combines:

* YAML or JSON for slide content
* PptxGenJS for editable PowerPoint elements
* Python for research charts
* MathJax or LaTeX for equation SVG files
* Mermaid, Graphviz, or native PowerPoint shapes for diagrams
* Optional generated images for decorative, non-authoritative illustrations
* Automated validation and preview rendering

The primary output is an editable `.pptx`.

The pipeline may also produce a stable PDF and page preview images.

## Core principles

1. Treat this repository as a reproducible build system, not as a one-off slide deck.
2. Keep factual content, data, layout rules, and generated assets separate.
3. Do not place a full-slide screenshot into the editable PowerPoint unless the slide is explicitly marked as `static`.
4. Titles, body text, tables, simple diagrams, and page furniture must use editable PowerPoint objects.
5. Generated images must not contain authoritative text, formulas, numerical results, citations, or data tables.
6. Never fabricate experimental values, citations, model names, datasets, or conclusions.
7. Preserve source files for every generated asset.
8. Do not overwrite manually edited deliverables.
9. Prefer simple, repeatable layouts over unconstrained automatic positioning.
10. Every build must run validation before being considered successful.

## Technology choices

* Language for PowerPoint generation: TypeScript
* PowerPoint library: PptxGenJS
* Content format: YAML
* Schema validation: Zod
* Chart generation: Python, pandas, and matplotlib
* Formula rendering: MathJax SVG first; LaTeX fallback
* Simple diagrams: native PptxGenJS shapes
* Medium-complexity diagrams: Mermaid or Graphviz SVG
* Complex academic diagrams: manually authored SVG, TikZ, or PowerPoint refinement
* Package manager: npm
* Test framework: Vitest
* Formatting: Prettier
* Linting: ESLint

Do not replace these choices without a clear technical reason.

## Target environment

Primary development environment:

* Windows 11
* Visual Studio Code
* PowerShell
* Microsoft PowerPoint as the reference presentation renderer

PowerPoint is the primary target. WPS, Keynote, LibreOffice, and Google Slides compatibility are secondary.

Use cross-platform Node.js APIs where practical, but provide Windows-compatible scripts.

## Slide dimensions

Use 16:9 widescreen PowerPoint dimensions.

* Width: 13.333 inches
* Height: 7.5 inches

All internal layout coordinates must use inches.

All coordinates and dimensions must be finite, non-negative numbers.

No foreground element may extend outside the slide bounds.

## Design system

Use a restrained academic style.

Default palette:

* Primary: `#003B70`
* Secondary: `#2F6FA3`
* Accent: `#56A0D3`
* Background: `#F7F9FC`
* Surface: `#FFFFFF`
* Primary text: `#182230`
* Secondary text: `#52606D`
* Divider: `#D7E0E8`
* Warning: `#C2413B`

Default fonts:

* Chinese: `Microsoft YaHei`
* English: `Aptos`
* Code: `Consolas`

Do not introduce additional colors without adding them to `src/theme.ts`.

Do not use neon effects, cyberpunk styling, excessive gradients, strong drop shadows, or decorative clutter.

## Typography rules

Default sizes:

* Cover title: 28–34 pt
* Slide title: 24–28 pt
* Section heading: 19–22 pt
* Body: 16–20 pt
* Caption: 11–14 pt
* Footer and page number: 9–11 pt

Minimum readable text size is 11 pt.

Preferred body text size is at least 17 pt.

Chinese body text should normally contain no more than:

* 4 bullets per slide
* 35 Chinese characters per bullet
* 7 visible lines in one text region

Do not silently reduce text below the minimum size to resolve overflow.

When content is too long, report the problem and recommend splitting the slide.

## Layout rules

Use only registered layouts from `src/layouts/`.

Initial supported layouts:

* `title`
* `text`
* `text-image`
* `diagram`
* `results`

Do not create arbitrary per-slide coordinates inside content files.

Content files specify semantic slots, not low-level drawing commands.

Each layout must define:

* title region
* content regions
* safe margins
* supported components
* maximum content density
* validation metadata

Default safe margins:

* Left: 0.55 in
* Right: 0.55 in
* Top: 0.35 in
* Bottom: 0.35 in

Keep at least 0.15 inches between unrelated foreground elements.

Decorative background objects may overlap content boxes only when explicitly marked as decorative.

## Content source rules

The canonical deck content is stored in `content/deck.yaml`.

Do not hard-code research claims, experimental results, or slide-specific text in layout components.

Slide content must pass schema validation before rendering.

Every slide must have:

* stable `id`
* `type`
* `title`, except intentionally title-free visual slides
* optional `speakerNotes`
* declared asset references
* declared citation references when applicable

Use stable slide IDs so generated assets do not depend on page order.

## Asset rules

Generated files go only into:

* `assets/generated/`
* `assets/charts/`
* `assets/equations/`
* `assets/diagrams/`
* `preview/`
* `output/`

Do not modify files in `assets/manual/`.

Every generated asset must have a corresponding source:

* chart SVG → CSV plus Python script
* equation SVG → source LaTeX string
* diagram SVG → Mermaid, DOT, TikZ, or source data
* generated illustration → prompt metadata file

Prefer SVG for equations, diagrams, logos, and charts.

Also support PNG fallback for problematic SVG files.

Do not stretch images. Preserve aspect ratio and crop deliberately.

Generated illustrations must use prompts that prohibit text, labels, numbers, formulas, and watermarks unless the image is purely decorative.

## Chart rules

Charts must be generated from files under `data/`.

Never embed fabricated placeholder data in production slides.

Chart scripts must:

* validate required columns
* report missing and non-numeric values
* use readable labels
* avoid unnecessary 3D effects
* export SVG and PNG fallback
* record the input file path

Do not set arbitrary colors directly in chart scripts. Read them from a shared theme configuration where practical.

For editable PowerPoint charts, document why native charts are required.

Otherwise prefer research-grade SVG output.

## Formula rules

Prefer MathJax-generated SVG for individual equations.

Use LaTeX or TikZ when MathJax cannot express the required construction.

Equation assets must:

* preserve transparent background
* avoid rasterization when possible
* store source text
* include accessible plain-text or LaTeX metadata

Never use screenshots of formulas when a vector representation is available.

## Diagram rules

Use native PowerPoint shapes for simple diagrams that need editing.

Examples:

* linear processes
* three-branch comparisons
* simple module boxes
* arrows and callouts

Use Mermaid or Graphviz for medium-complexity diagrams.

Use TikZ or manually authored SVG for complex academic architecture diagrams.

Do not use generated AI images for technically authoritative architecture diagrams.

## PowerPoint generation rules

Use PptxGenJS.

Create reusable components for:

* slide title
* footer
* page number
* text block
* image block
* table
* metric card
* process node
* connector
* citation footer

Do not duplicate layout code between slide types.

Do not use one full-slide image as the editable slide implementation.

All editable text must use `addText`.

Simple tables must use `addTable`.

Simple diagrams must use `addShape`, `addText`, and connectors.

Use shared helpers for image fitting and cropping.

Generated `.pptx` files must be written to `output/generated/`.

Never overwrite `output/final-edited.pptx`.

## Validation requirements

Every build must validate:

1. content schema
2. missing asset references
3. slide bounds
4. invalid dimensions
5. text length limits
6. likely text overflow
7. unintended object overlap
8. objects below minimum font size
9. unsupported slide types
10. duplicate slide IDs
11. missing source data
12. missing citations where the content marks them as required

Validation errors must fail the build.

Validation warnings may allow the build but must be written to:

`output/validation-report.json`

Overlap checks must distinguish:

* background
* decoration
* content
* overlay

Do not report intentional background-content overlap as an error.

## Preview and visual QA

When a compatible renderer is available, render the generated presentation to PDF or PNG previews.

Store previews under `preview/`.

Visual QA should inspect:

* title hierarchy
* clipping
* crowded text
* obvious overlap
* inconsistent margins
* distorted images
* unreadable charts
* inconsistent font sizes
* missing assets
* poor contrast

Automated visual checks are advisory. They do not replace manual review in Microsoft PowerPoint.

## Testing

After modifying TypeScript files, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

After modifying Python chart scripts, run the chart generation command and relevant tests.

For layout changes, generate the sample deck and inspect previews.

Do not claim success unless required commands completed successfully.

If a command cannot run because a dependency is missing, report the exact dependency and continue with all checks that can still run.

## Development process

For non-trivial tasks:

1. inspect the repository
2. summarize relevant architecture
3. propose a small implementation plan
4. modify only the necessary files
5. run focused checks
6. run the full relevant validation
7. summarize changed files and remaining risks

Prefer incremental changes.

Do not rewrite unrelated working code.

Do not add production dependencies without explaining why they are necessary.

Prefer small, testable modules.

## Git rules

Before a large change, inspect the current Git status.

Do not discard user changes.

Do not run destructive Git commands unless explicitly requested.

Do not force-push.

Do not commit generated previews unless repository policy explicitly requires them.

Recommended commit boundaries:

* project scaffold
* content schema
* base theme and components
* first layouts
* chart pipeline
* formula pipeline
* diagram pipeline
* validation
* preview rendering
* documentation

## Security and secrets

Never commit:

* API keys
* access tokens
* private datasets
* unpublished personal information

Read secrets from environment variables.

Keep `.env` ignored.

Provide `.env.example` containing variable names but no real values.

Do not log secrets.

## Image generation API rules

Image generation is optional and isolated from the core build.

The core PPT build must still work when no image API key is configured.

Image generation tasks must:

* use prompts stored in content or metadata files
* cache results
* skip unchanged outputs
* use bounded retries
* record prompt and model metadata
* never fabricate scientific evidence
* never place generated text or numbers into authoritative slides

Generated images are decorative or conceptual only.

## Documentation requirements

Keep these files current:

* `README.md`: installation and common commands
* `docs/architecture.md`: pipeline architecture
* `docs/content-schema.md`: deck YAML schema
* `docs/troubleshooting.md`: common failures
* `.env.example`: optional environment variables

After every implementation, content, configuration, or build-behavior change, update `docs/stage.md` with why the change was made, what changed, and how it was verified.

For every such change, review and attempt to update all of the following documentation in the same task; update each file whose described behavior, interface, workflow, or failure mode is affected:

* `docs/architecture.md`
* `docs/content-schema.md`
* `docs/troubleshooting.md`

When behavior changes, update the relevant documentation in the same task.

## Definition of done

A task is complete only when:

* code is implemented
* content schema remains valid
* required tests pass
* sample presentation builds
* validation report is generated
* changed behavior is documented
* no secrets or temporary debug files are committed
* remaining visual risks are explicitly stated
