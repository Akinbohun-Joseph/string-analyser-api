
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.use(express.json());

// Global error handler (prevents crashes/502s)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

interface StringProperties {
  length: number;
  is_palindrome: boolean;
  unique_characters: number;
  word_count: number;
  sha256_hash: string;
  character_frequency_map: Record<string, number>;
}

interface StoredString {
  id: string;
  value: string;
  properties: StringProperties;
  created_at: string;
}

const storage = new Map<string, StoredString>();

function computeProperties(value: string): StringProperties {
  const length = value.length;
  const lowerValue = value.toLowerCase();
  const is_palindrome = lowerValue === lowerValue.split('').reverse().join('');
  const uniqueSet = new Set(value.split('')); // Case-sensitive unique count (matches spec example)
  const unique_characters = uniqueSet.size;
  const words = value.trim().split(/\s+/);
  const word_count = words.length;
  const sha256_hash = crypto.createHash('sha256').update(value).digest('hex');
  const character_frequency_map: Record<string, number> = {};
  for (const char of value.toLowerCase()) { // Lowercase keys for map (spec example)
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }
  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map
  };
}

// POST /strings
app.post('/strings', (req: Request, res: Response) => {
  try {
    const { value } = req.body as { value?: string | number };
    if (value === undefined) {
      return res.status(400).json({ error: 'Missing "value" field' });
    }
    if (typeof value !== 'string') {
      return res.status(422).json({ error: 'Invalid data type for "value" (must be string)' });
    }
    const props = computeProperties(value);
    const id = props.sha256_hash;
    if (storage.has(id)) {
      return res.status(409).json({ error: 'String already exists in the system' });
    }
    const created_at = new Date().toISOString();
    const stored: StoredString = { id, value, properties: props, created_at };
    storage.set(id, stored);
    res.status(201).json(stored);
  } catch (err) {
    console.error('POST /strings error:', err);
    res.status(500).json({ error: 'Internal error processing request' });
  }
});

// GET /strings (list with filters) - exact match before params
app.get('/strings', (req: Request, res: Response) => {
  try {
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character
    } = req.query;

    const filters: Record<string, any> = {};

    if (is_palindrome !== undefined) {
      if (is_palindrome !== 'true' && is_palindrome !== 'false') {
        return res.status(400).json({ error: 'Invalid query parameter: is_palindrome must be true or false' });
      }
      filters.is_palindrome = is_palindrome === 'true';
    }

    if (min_length !== undefined) {
      const minLen = Number(min_length);
      if (isNaN(minLen) || minLen < 0) {
        return res.status(400).json({ error: 'Invalid query parameter: min_length must be a non-negative integer' });
      }
      filters.min_length = minLen;
    }

    if (max_length !== undefined) {
      const maxLen = Number(max_length);
      if (isNaN(maxLen) || maxLen < 0) {
        return res.status(400).json({ error: 'Invalid query parameter: max_length must be a non-negative integer' });
      }
      filters.max_length = maxLen;
    }

    if (word_count !== undefined) {
      const wc = Number(word_count);
      if (isNaN(wc) || wc < 0) {
        return res.status(400).json({ error: 'Invalid query parameter: word_count must be a non-negative integer' });
      }
      filters.word_count = wc;
    }

    if (contains_character !== undefined) {
      const char = contains_character as string;
      if (typeof char !== 'string' || char.length !== 1) {
        return res.status(400).json({ error: 'Invalid query parameter: contains_character must be a single character' });
      }
      filters.contains_character = char;
    }

    const allStrings = Array.from(storage.values());
    const filtered = allStrings.filter((s) => {
      if (filters.is_palindrome !== undefined && s.properties.is_palindrome !== filters.is_palindrome) return false;
      if (filters.min_length !== undefined && s.properties.length < filters.min_length) return false;
      if (filters.max_length !== undefined && s.properties.length > filters.max_length) return false;
      if (filters.word_count !== undefined && s.properties.word_count !== filters.word_count) return false;
      if (filters.contains_character !== undefined && !s.value.includes(filters.contains_character)) return false;
      return true;
    });

    res.json({
      data: filtered,
      count: filtered.length,
      filters_applied: filters
    });
  } catch (err) {
    console.error('GET /strings error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /strings/filter-by-natural-language - specific before param route
app.get('/strings/filter-by-natural-language', (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Unable to parse natural language query: missing or invalid query' });
    }

    const lowerQuery = query.toLowerCase();
    const parsedFilters: Record<string, any> = {};

    // Palindrome detection
    if (lowerQuery.includes('palindromic') || lowerQuery.includes('palindrome')) {
      parsedFilters.is_palindrome = true;
    }

    // Word count: single/one word
    if (lowerQuery.includes('single word') || lowerQuery.includes('one word')) {
      parsedFilters.word_count = 1;
    }

    // Length: longer than / more than X characters
    const lengthMatch = lowerQuery.match(/(longer|more) than\s+(\d+)\s*character/);
    if (lengthMatch) {
      parsedFilters.min_length = Number(lengthMatch[2]) + 1;
    }

    // Contains character: improved regex for "containing the letter z" etc.
    const letterMatch = lowerQuery.match(/contain(?:s|ing)?\s+(?:the\s+)?letter\s+([a-z])/i);
    if (letterMatch) {
      parsedFilters.contains_character = letterMatch[1];
    } else if (lowerQuery.includes('first vowel')) {
      parsedFilters.contains_character = 'a'; // Heuristic
    }

    // Fallback for simple "contains z"
    const simpleContains = lowerQuery.match(/contains\s+([a-z])/i);
    if (simpleContains && !parsedFilters.contains_character) {
      parsedFilters.contains_character = simpleContains[1];
    }

    if (Object.keys(parsedFilters).length === 0) {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    // Simple conflict check
    if (parsedFilters.min_length && parsedFilters.max_length && parsedFilters.min_length > parsedFilters.max_length) {
      return res.status(422).json({ error: 'Query parsed but resulted in conflicting filters' });
    }

    const allStrings = Array.from(storage.values());
    const filtered = allStrings.filter((s) => {
      for (const [key, val] of Object.entries(parsedFilters)) {
        if (key === 'is_palindrome' && s.properties.is_palindrome !== val) return false;
        if (key === 'min_length' && s.properties.length < val) return false;
        if (key === 'word_count' && s.properties.word_count !== val) return false;
        if (key === 'contains_character' && !s.value.includes(val)) return false;
      }
      return true;
    });

    res.json({
      data: filtered,
      count: filtered.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters
      }
    });
  } catch (err) {
    console.error('GET /filter-by-natural-language error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /strings/:value - catch-all after specifics
app.get('/strings/:value', (req: Request, res: Response) => {
  try {
    const { value } = req.params;
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    const stored = storage.get(hash);
    if (!stored) {
      return res.status(404).json({ error: 'String does not exist in the system' });
    }
    res.json(stored);
  } catch (err) {
    console.error('GET /strings/:value error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /strings/:value - catch-all after specifics
app.delete('/strings/:value', (req: Request, res: Response) => {
  try {
    const { value } = req.params;
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    if (!storage.delete(hash)) {
      return res.status(404).json({ error: 'String does not exist in the system' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /strings/:value error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});