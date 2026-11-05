# Question Desk

Upload a question paper (PDF, Word, text, or a photo). Gemini turns it into questions, marks, and an answer key. Students enter a name and email, then submit answers. Gemini scores each answer by meaning, and the examiner dashboard shows who answered and whether each question was correct.

## Run

Node.js 20 or newer:

```bash
nvm use
cp .env.example .env
```

Put the admin login and the Gemini key in `.env`. The key stays on the server and is never typed into the website. A Google AI Studio key calls Gemini directly. An OpenRouter key calls Gemini through OpenRouter.

```
ADMIN_EMAIL=admin@questiondesk.com
ADMIN_PASSWORD=admin123
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.5-flash
```

```bash
npm install
npm run dev
```

- Students: http://127.0.0.1:5173
- Examiner dashboard: http://127.0.0.1:5173/admin

Sign in at the examiner desk with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Papers, questions, answer keys, and student answers are stored in MongoDB (`questiondesk`). A sample paper is in `samples/sample-paper.txt`.

## What each side can see

Students see the questions and, after submit, marks, correct or not, and a short note. They do not see the answer key.

The dashboard shows every paper, the answer key, how many students submitted, and a correct or not result on every answer.
