String Analyzer API
A RESTful API service built with Node.js and TypeScript that analyzes input strings, computes their properties (length, palindrome check, unique characters count, word count, SHA-256 hash, and character frequency map), and stores them in an in-memory database. Supports CRUD operations with filtering, including natural language query parsing.
Features

POST /strings: Analyze and store a new string.
GET /strings/{value}: Retrieve a specific string by its value.
GET /strings: List all strings with optional filters (e.g., ?is_palindrome=true&min_length=5).
GET /strings/filter-by-natural-language?query=...: Filter strings using natural language queries (e.g., "all single word palindromic strings").
DELETE /strings/{value}: Delete a string by its value.
In-memory storage using a Map (persists only during runtime; restarts clear data).
Case-insensitive palindrome check; case-sensitive unique chars and frequency.
Simple keyword-based natural language parser for supported query patterns.

Setup Instructions

Clone the Repository
textgit clone https://github.com/Akinbohun-Joseph/string-analyzer-api.git
cd string-analyzer-api

Install Dependencies

Ensure Node.js >=18 is installed.
Run:
textnpm install



Build the Project
textnpm run build

Run Locally

Development mode (with TypeScript):
textnpm run dev

Production mode:
textnpm start

The server runs on http://localhost:3000 by default.


Environment Variables

PORT: Optional, defaults to 3000. Set for hosting (e.g., PORT=8080).



Testing the API
Use tools like Postman, curl, or Thunder Client.
Examples

Create String
textcurl -X POST http://localhost:3000/strings \
  -H "Content-Type: application/json" \
  -d '{"value": "string to analyze"}'
Expected: 201 with computed properties.
Get Specific String
textcurl http://localhost:3000/strings/string%20to%20analyze
Expected: 200 with stored data.
List with Filters
textcurl "http://localhost:3000/strings?is_palindrome=true&min_length=5"
Expected: 200 with filtered list.
Natural Language Filter
textcurl "http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings"
Expected: 200 with parsed filters and results.
Delete
textcurl -X DELETE http://localhost:3000/strings/string%20to%20analyze
Expected: 204.


Notes:

String lookup/deletion uses the original value (URL-encode spaces/special chars).
Natural language supports: palindromes, single-word, length > N chars, contains letter (e.g., 'z'), first vowel heuristic.
Tested with Node.js v20; endpoints return exact formats per spec.
No external DB; for production, integrate MongoDB/PostgreSQL.



Hosting

Heroku:

Install Heroku CLI.
heroku create your-app-name.
git push heroku main.
Base URL: https://your-app-name.herokuapp.com.


Railway:

Connect GitHub repo to Railway.app.
Deploy; auto-detects Node.js.


AWS (EC2/Lambda): Use PM2 for process management; configure via environment vars.
Forbidden: Vercel, Render.

Dependencies

Runtime: express (web framework).
Dev: @types/express, @types/node, ts-node, typescript.
Install via npm install.

API Documentation

OpenAPI/Swagger not included; use the endpoint specs in the project prompt.
Error handling: 400/404/409/422 as specified.

Tests

Basic integration tests can be added with Jest/Supertest.
Manual testing verified: Property computation, filtering, NLP parsing for examples.

Repository
GitHub: https://github.com/Akinbohun-Joseph/string-analyzer-api 
