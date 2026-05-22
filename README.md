# IELTS 词根记忆脑图

<p align="center">
  <img src="https://img.shields.io/badge/IELTS-Vocabulary-blue?style=flat-square" alt="IELTS Vocabulary">
  <img src="https://img.shields.io/badge/Words-275-green?style=flat-square" alt="275 Words">
  <img src="https://img.shields.io/badge/Roots-146-orange?style=flat-square" alt="146 Roots">
</p>

An interactive vocabulary learning tool built around **root-word etymology**, featuring an ECharts mind map and comprehensive study aids. Designed for Chinese-speaking IELTS students.

## Features

- **ECharts Mind Map** — Tree visualization showing root → derivation relationships, click any node to explore
- **275 Words / 146 Root Groups** — Organized by Latin/Greek roots with full etymological breakdowns
- **Rich Word Data**：
  - Phonetics & POS with Chinese translations
  - Etymology (词源拆解) — prefix + root + suffix analysis
  - Mnemonic (一句话记忆) — one-sentence memory aids
  - IELTS example sentences with Chinese translations
  - Inflections (变形态) with POS & meaning
  - Synonyms & Antonyms
  - Common phrases & collocations
- **AI-Generated Tips** — 11 categories covering prefixes, suffixes, synonym groups, academic vocabulary, commonly misspelled words, and polysemy
- **Text-to-Speech** — Web Speech API with auto-read support
- **Smart Search** — Search by word, root, Chinese meaning, or phonetic
- **Dictation Mode** — Practice spelling with speech prompts
- **Favorites** — Bookmark words and phrases for review
- **Paste Import** — Batch import words from text (like Taobao address parser)
- **Online Dictionary** — Look up any word via Free Dictionary API with fallback to Youdao/Cambridge
- **Edit Mode** — Modify data in-browser (password protected: `01021130`)
- **Standalone Export** — Generate self-contained HTML with embedded data

## Quick Start

```bash
# Open locally
open index.html
```

Or visit the deployed site (password gate):
- **View mode**: password `123456`

## Project Structure

```
ielts-app/
├── index.html          # Main application (single-page, self-contained)
├── data.json           # Word database (275 words, 146 root groups)
├── tips-data.js        # AI-generated vocabulary tips (11 categories)
├── enrich.js           # AI enrichment script — generates word data
├── enrich2.js          # AI enrichment pass 2 — etymology & mnemonics
├── gen_tips.js         # AI tips generation script
├── gen_tips2.js        # AI expanded tips generation
├── tips.json           # Tips in JSON format
└── package.json        # Node dependencies (Anthropic SDK)
```

## Data Enrichment

The word data is enriched via Anthropic Claude API. To regenerate:

```bash
# Set your API credentials
$env:ANTHROPIC_API_KEY = "your-key"
$env:ANTHROPIC_BASE_URL = "https://api.anthropic.com"

# Generate tips
node gen_tips2.js

# Enrich word data (etymology, mnemonics, sentences)
node enrich2.js
```

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS, Tailwind CSS (CDN), ECharts 5.5
- **APIs**: Web Speech API (TTS), Free Dictionary API
- **Build**: No build step — single HTML file runs directly
- **AI**: Anthropic Claude SDK for data enrichment (Node.js)

## License

MIT
