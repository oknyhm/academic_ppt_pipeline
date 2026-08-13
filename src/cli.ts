import type { Deck } from "./types.js";
import { validateDeckFile } from "./validators/index.js";

const DEFAULT_DECK_PATH = "content/deck.yaml";

function printDeckSummary(deck: Deck): void {
  console.log(`Deck: ${deck.meta.title}`);
  console.log(`Slides: ${deck.slides.length}`);
  for (const [index, slide] of deck.slides.entries()) {
    console.log(`${index + 1}. [${slide.layout}] ${slide.id} — ${slide.title ?? "(untitled)"}`);
  }
}

async function main(): Promise<void> {
  const [command = "validate", deckPath = DEFAULT_DECK_PATH] = process.argv.slice(2);
  if (command !== "validate") {
    throw new Error(`Unsupported command: ${command}. Use: validate [deck-path]`);
  }

  const result = await validateDeckFile(deckPath);
  if (result.deck) printDeckSummary(result.deck);
  for (const warning of result.report.warnings)
    console.warn(`Warning [${warning.code}]: ${warning.message}`);
  for (const error of result.report.errors)
    console.error(`Error [${error.code}]: ${error.message}`);
  console.log(
    `Validation report: output/validation-report.json (${result.report.summary.errors} error(s), ${result.report.summary.warnings} warning(s))`,
  );
  console.log(result.report.manualReviewMessage);
  if (!result.report.valid) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
});
