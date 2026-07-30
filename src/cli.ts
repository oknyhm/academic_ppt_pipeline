import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { DeckSchema, type Deck } from "./types.js";

const DEFAULT_DECK_PATH = "content/deck.yaml";

function printDeckSummary(deck: Deck): void {
  console.log(`Deck: ${deck.meta.title}`);
  console.log(`Slides: ${deck.slides.length}`);
  for (const [index, slide] of deck.slides.entries()) {
    console.log(`${index + 1}. [${slide.layout}] ${slide.id} — ${slide.title ?? "(untitled)"}`);
  }
}

async function loadDeck(path: string): Promise<Deck> {
  const source = await readFile(resolve(process.cwd(), path), "utf8");
  return DeckSchema.parse(parse(source));
}

async function main(): Promise<void> {
  const [command = "validate", deckPath = DEFAULT_DECK_PATH] = process.argv.slice(2);
  if (command !== "validate") {
    throw new Error(`Unsupported command: ${command}. Use: validate [deck-path]`);
  }

  const deck = await loadDeck(deckPath);
  printDeckSummary(deck);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
});
