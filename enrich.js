// enrich.js — AI-powered enrichment for IELTS word data
// Uses Anthropic-compatible API to fill in missing POS, meanings, translations, synonyms, antonyms

const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const DATA_FILE = path.join(__dirname, 'data.json');
const BATCH_SIZE = 4; // words per API call (smaller to avoid truncation)

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

function buildPrompt(words) {
  const items = words.map((w, i) => {
    const parts = [];
    parts.push(`[${i}] word: "${w.word}", meaning: "${w.meaning}"`);
    if (w.inflections && w.inflections.length > 0) {
      const infStr = w.inflections
        .filter(inf => !inf.pos || !inf.meaning)
        .map(inf => inf.word).join(', ');
      if (infStr) parts.push(`  inflections needing POS+Chinese meaning: ${infStr}`);
    }
    if (w.ielts_sentences && w.ielts_sentences.length > 0) {
      const needZh = w.ielts_sentences.filter(s => !s.zh);
      if (needZh.length > 0) {
        parts.push(`  sentences needing Chinese translation:`);
        needZh.forEach((s, si) => parts.push(`    sent_${si}: "${s.en}"`));
      }
    }
    if (!w.synonyms || w.synonyms.length === 0) {
      parts.push(`  need 2-3 synonyms with POS+Chinese meaning`);
    }
    if (!w.antonyms || w.antonyms.length === 0) {
      parts.push(`  need 1-2 antonyms with POS+Chinese meaning`);
    }
    return parts.join('\n');
  }).join('\n\n');

  return `You are an IELTS vocabulary expert. For each word below, provide:
1. **Inflections**: For each inflection form, give its part of speech (POS) and Chinese meaning. Use abbreviations: n., v., vt., vi., adj., adv., prep., conj.
2. **Chinese translations**: Translate each English sentence to natural Chinese.
3. **Synonyms**: 2-3 synonyms with POS + Chinese meaning (words with similar meaning).
4. **Antonyms**: 1-2 antonyms with POS + Chinese meaning (words with opposite meaning).

Return ONLY valid JSON in this exact format:
{
  "results": [
    {
      "index": 0,
      "inflections": {
        "inflectionword1": {"pos": "n.", "meaning": "中文含义"},
        "inflectionword2": {"pos": "adj.", "meaning": "中文含义"}
      },
      "sentences": {
        "sent_0": "中文翻译",
        "sent_1": "中文翻译"
      },
      "synonyms": [
        {"word": "synonym1", "pos": "n.", "meaning": "中文含义"}
      ],
      "antonyms": [
        {"word": "antonym1", "pos": "adj.", "meaning": "中文含义"}
      ]
    }
  ]
}

Words to process:
${items}

Return ONLY the JSON, no other text.`;
}

async function enrichBatch(words, batchNum, totalBatches) {
  const prompt = buildPrompt(words);

  console.log(`\n--- Batch ${batchNum}/${totalBatches}: ${words.length} words ---`);

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0.3,
    system: 'You are an IELTS vocabulary expert. You output ONLY valid JSON, never any other text.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('');

  // Extract JSON from response (may be wrapped in ```json blocks)
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to repair truncated JSON
    console.warn('  JSON parse failed, attempting repair...');
    try {
      // Try adding missing closing brackets
      let repaired = jsonStr;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      // Fix unclosed strings at the end
      if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
      return JSON.parse(repaired);
    } catch (e2) {
      console.error('  Repair also failed. Raw text:', text.substring(0, 300));
      throw e;
    }
  }
}

function applyEnrichment(data, batchWords, enrichment) {
  const results = enrichment.results;
  if (!results) {
    console.error('No results in enrichment response');
    return 0;
  }

  let applied = 0;

  results.forEach(r => {
    const wordData = batchWords[r.index];
    if (!wordData) return;

    // Find the word in the full data
    const found = findWord(data, wordData.word);
    if (!found) return;

    let changed = false;

    // Apply inflections
    if (r.inflections) {
      Object.entries(r.inflections).forEach(([infWord, info]) => {
        const inf = found.inflections.find(i => i.word.toLowerCase() === infWord.toLowerCase());
        if (inf && (!inf.pos || !inf.meaning)) {
          inf.pos = info.pos || '';
          inf.meaning = info.meaning || '';
          changed = true;
        }
      });
    }

    // Apply sentence translations
    if (r.sentences) {
      Object.entries(r.sentences).forEach(([key, zh]) => {
        const idx = parseInt(key.replace('sent_', ''));
        if (!isNaN(idx) && found.ielts_sentences[idx] && !found.ielts_sentences[idx].zh) {
          found.ielts_sentences[idx].zh = zh;
          changed = true;
        }
      });
    }

    // Apply synonyms
    if (r.synonyms && r.synonyms.length > 0 && found.synonyms.length === 0) {
      found.synonyms = r.synonyms;
      changed = true;
    }

    // Apply antonyms
    if (r.antonyms && r.antonyms.length > 0 && found.antonyms.length === 0) {
      found.antonyms = r.antonyms;
      changed = true;
    }

    if (changed) applied++;
  });

  return applied;
}

function findWord(data, word) {
  for (const root of data) {
    for (const w of root.words) {
      if (w.word === word) return w;
    }
  }
  return null;
}

async function main() {
  console.log('Loading data...');
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Collect all words that need enrichment
  const allWords = [];
  data.forEach(root => {
    root.words.forEach(w => {
      const needsInfPos = w.inflections.some(inf => !inf.pos || !inf.meaning);
      const needsSentZh = w.ielts_sentences.some(s => !s.zh);
      const needsSyn = !w.synonyms || w.synonyms.length === 0;
      const needsAnt = !w.antonyms || w.antonyms.length === 0;

      if (needsInfPos || needsSentZh || needsSyn || needsAnt) {
        allWords.push(w);
      }
    });
  });

  console.log(`${allWords.length} words need enrichment out of ${data.reduce((s, r) => s + r.words.length, 0)} total`);

  // Process in batches
  const batches = [];
  for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
    batches.push(allWords.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} words each...`);

  let totalApplied = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const enrichment = await enrichBatch(batch, i + 1, batches.length);
      const applied = applyEnrichment(data, batch, enrichment);
      totalApplied += applied;
      console.log(`  Batch ${i + 1}: enriched ${applied}/${batch.length} words`);

      // Save after each batch (checkpoint)
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`  Batch ${i + 1} failed:`, err.message);
      // Continue with next batch
    }

    // Small delay to avoid rate limiting
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Total words enriched: ${totalApplied}`);
  console.log(`Data saved to: ${DATA_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
