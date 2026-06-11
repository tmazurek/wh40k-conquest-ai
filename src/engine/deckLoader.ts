import { CardDefinition } from './types';
import { CARD_DB } from '../data/cards';

export interface ParsedDeck {
  filename: string;
  name: string;
  warlordId: string | null;
  deckList: string[];
}

export function parseDeckContent(filename: string, content: string, cardDb: Record<string, CardDefinition>): ParsedDeck {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let name = filename.replace(/\.txt$/, '');
  if (lines.length > 0 && !lines[0].includes('---') && !lines[0].match(/^\d+x/)) {
    name = lines[0];
  }
  
  const deckList: string[] = [];
  let warlordId: string | null = null;
  
  // Build name-to-id mapping helper
  const nameToId: Record<string, string> = {};
  for (const [id, card] of Object.entries(cardDb)) {
    // Normalize names by removing punctuation and converting to lowercase
    const norm = card.name.toLowerCase().replace(/['"’!]/g, '').replace(/\s+/g, ' ').trim();
    nameToId[norm] = id;
  }

  // Also include exact lowercased name lookups
  for (const [id, card] of Object.entries(cardDb)) {
    nameToId[card.name.toLowerCase().trim()] = id;
  }
  
  for (let line of lines) {
    // Skip headers and section separators
    if (
      line.startsWith('---') ||
      line === name ||
      line === 'Signature Squad' ||
      line === 'Army' ||
      line === 'Support' ||
      line === 'Synapse' ||
      line === 'Attachment' ||
      line === 'Event' ||
      line === 'Planet'
    ) {
      continue;
    }
    
    // Check if the line exactly matches a warlord (e.g. "Captain Cato Sicarius")
    const cleanLine = line.toLowerCase().replace(/['"’!]/g, '').replace(/\s+/g, ' ').trim();
    const cleanLineExact = line.toLowerCase().trim();
    const potentialWarlordId = nameToId[cleanLine] || nameToId[cleanLineExact];
    if (potentialWarlordId && cardDb[potentialWarlordId].type === 'Warlord') {
      warlordId = potentialWarlordId;
      continue;
    }
    
    // Parse quantity and name, e.g., "2x 10th Company Scout" or "2 10th Company Scout"
    const match = line.match(/^(\d+)x?\s+(.+)$/);
    if (match) {
      const qty = parseInt(match[1], 10);
      const cardNameRaw = match[2].trim();
      const cardNameNorm = cardNameRaw.toLowerCase().replace(/['"’!]/g, '').replace(/\s+/g, ' ').trim();
      const cardNameExact = cardNameRaw.toLowerCase();
      const cardId = nameToId[cardNameNorm] || nameToId[cardNameExact];
      
      if (cardId) {
        for (let i = 0; i < qty; i++) {
          deckList.push(cardId);
        }
      } else {
        console.warn(`[Deck Loader] Could not resolve card for name: "${cardNameRaw}"`);
      }
    }
  }
  
  return { filename, name, warlordId, deckList };
}

export function loadUserDecks(): ParsedDeck[] {
  // Vite feature to import all txt files eagerly as raw string contents
  const modules = import.meta.glob('../components/decks-user/*.txt', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  
  const parsedDecks: ParsedDeck[] = [];
  
  for (const [path, content] of Object.entries(modules)) {
    const filename = path.split('/').pop() || path;
    try {
      const parsed = parseDeckContent(filename, content, CARD_DB);
      parsedDecks.push(parsed);
    } catch (e) {
      console.error(`Failed to parse deck file ${filename}:`, e);
    }
  }
  
  return parsedDecks;
}
