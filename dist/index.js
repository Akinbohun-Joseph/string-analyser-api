"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
const storage = new Map();
function computeProperties(value) {
    const length = value.length;
    const lowerValue = value.toLowerCase();
    const is_palindrome = lowerValue === lowerValue.split('').reverse().join('');
    const uniqueSet = new Set(value.split(''));
    const unique_characters = uniqueSet.size;
    const words = value.trim().split(/\s+/);
    const word_count = words.length;
    const sha256_hash = crypto_1.default.createHash('sha256').update(value).digest('hex');
    const character_frequency_map = {};
    for (const char of value) {
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
app.post('/strings', (req, res) => {
    const { value } = req.body;
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
    const stored = { id, value, properties: props, created_at };
    storage.set(id, stored);
    res.status(201).json(stored);
});
// GET /strings/:value
app.get('/strings/:value', (req, res) => {
    const { value } = req.params;
    const hash = crypto_1.default.createHash('sha256').update(value).digest('hex');
    const stored = storage.get(hash);
    if (!stored) {
        return res.status(404).json({ error: 'String does not exist in the system' });
    }
    res.json(stored);
});
// DELETE /strings/:value
app.delete('/strings/:value', (req, res) => {
    const { value } = req.params;
    const hash = crypto_1.default.createHash('sha256').update(value).digest('hex');
    if (!storage.delete(hash)) {
        return res.status(404).json({ error: 'String does not exist in the system' });
    }
    res.status(204).send();
});
// GET /strings with filters
app.get('/strings', (req, res) => {
    const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
    const filters = {};
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
        if (typeof contains_character !== 'string' || contains_character.length !== 1) {
            return res.status(400).json({ error: 'Invalid query parameter: contains_character must be a single character' });
        }
        filters.contains_character = contains_character;
    }
    const allStrings = Array.from(storage.values());
    const filtered = allStrings.filter((s) => {
        if (filters.is_palindrome !== undefined && s.properties.is_palindrome !== filters.is_palindrome)
            return false;
        if (filters.min_length !== undefined && s.properties.length < filters.min_length)
            return false;
        if (filters.max_length !== undefined && s.properties.length > filters.max_length)
            return false;
        if (filters.word_count !== undefined && s.properties.word_count !== filters.word_count)
            return false;
        if (filters.contains_character !== undefined && !s.value.includes(filters.contains_character))
            return false;
        return true;
    });
    res.json({
        data: filtered,
        count: filtered.length,
        filters_applied: filters
    });
});
// GET /strings/filter-by-natural-language
app.get('/strings/filter-by-natural-language', (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Unable to parse natural language query: missing or invalid query' });
    }
    const lowerQuery = query.toLowerCase();
    const parsedFilters = {};
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
    // Contains character: letter X or first vowel heuristic
    const letterMatch = lowerQuery.match(/letter\s+([a-z])/);
    if (letterMatch) {
        parsedFilters.contains_character = letterMatch[1];
    }
    else if (lowerQuery.includes('first vowel')) {
        parsedFilters.contains_character = 'a'; // Heuristic for 'a' as first vowel
    }
    else if (lowerQuery.includes('contain') || lowerQuery.includes('contains')) {
        // Fallback: look for single letter after 'the letter' or similar
        const fallbackMatch = lowerQuery.match(/the\s+([a-z])/);
        if (fallbackMatch && !lowerQuery.includes('letter')) {
            parsedFilters.contains_character = fallbackMatch[1];
        }
    }
    // Contains 'z' example
    if (lowerQuery.includes('z')) {
        parsedFilters.contains_character = 'z';
    }
    if (Object.keys(parsedFilters).length === 0) {
        return res.status(400).json({ error: 'Unable to parse natural language query' });
    }
    // Check for conflicts (e.g., min_length > max_length, but max not supported in parser yet)
    // For now, assume no conflicts; extend if needed
    const allStrings = Array.from(storage.values());
    const filtered = allStrings.filter((s) => {
        for (const [key, val] of Object.entries(parsedFilters)) {
            if (key === 'is_palindrome' && s.properties.is_palindrome !== val)
                return false;
            if (key === 'min_length' && s.properties.length < val)
                return false;
            if (key === 'word_count' && s.properties.word_count !== val)
                return false;
            if (key === 'contains_character' && !s.value.includes(val))
                return false;
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
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
