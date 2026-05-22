// enrich2.js — Generate etymology, mnemonic, and additional IELTS phrases
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const DATA_FILE = path.join(__dirname, 'data.json');
const BATCH_SIZE = 6;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

function buildPrompt(words) {
  const items = words.map((w, i) => {
    return `[${i}] word: "${w.word}", meaning: "${w.meaning}", root: "${w._root || 'unknown'}"`;
  }).join('\n');

  return `You are an IELTS vocabulary expert. For each word below, provide:

1. **etymology** (词根拆解): Break down the word into prefix + root + suffix, explaining how the parts combine to form the meaning. Format in Chinese with English roots. Example: "sub(在...之下) + mit(送) → 从下面送上去 → 提交，服从"

2. **mnemonic** (一句话记忆): A memorable Chinese sentence that helps remember the word's meaning through association, homophony, or imagery. Make it vivid and easy to remember. Example for "submit": "下属(sub)必须提交报告给经理(mit)，就像把文件送上去一样"

3. **extra_phrases** (额外雅思词组): 2-3 common IELTS exam collocations or fixed expressions with Chinese translations. These should be DIFFERENT from existing phrases. Format: [{"en": "...", "zh": "..."}]

Return ONLY valid JSON:
{
  "results": [
    {
      "index": 0,
      "etymology": "词根拆解内容",
      "mnemonic": "记忆句子",
      "extra_phrases": [{"en": "phrase in English", "zh": "中文翻译"}]
    }
  ]
}

Words to process:
${items}

Return ONLY the JSON, no other text.`;
}

function applyEnrichment(data, batchWords, enrichment) {
  const results = enrichment.results;
  if (!results) return 0;
  let applied = 0;

  results.forEach(r => {
    const w = batchWords[r.index];
    if (!w) return;

    // Find in full data
    let found = null;
    for (const root of data) {
      for (const word of root.words) {
        if (word.word === w.word) { found = word; break; }
      }
      if (found) break;
    }
    if (!found) return;

    let changed = false;

    if (r.etymology && !found.etymology) {
      found.etymology = r.etymology;
      changed = true;
    }
    if (r.mnemonic && !found.mnemonic) {
      found.mnemonic = r.mnemonic;
      changed = true;
    }
    if (r.extra_phrases && r.extra_phrases.length > 0) {
      const existingEns = new Set((found.ielts_phrases || []).map(p => (typeof p === 'object' ? p.en.toLowerCase() : p.toLowerCase())));
      const newPhrases = r.extra_phrases.filter(p => !existingEns.has(p.en.toLowerCase()));
      if (newPhrases.length > 0) {
        found.ielts_phrases = (found.ielts_phrases || []).concat(newPhrases);
        changed = true;
      }
    }

    if (changed) applied++;
  });

  return applied;
}

async function enrichBatch(words, batchNum, totalBatches) {
  // Add root info for context
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  words.forEach(w => {
    for (const root of data) {
      if (root.words.some(rw => rw.word === w.word)) {
        w._root = root.root + ' — ' + (root.root_meaning || '');
        break;
      }
    }
  });

  const prompt = buildPrompt(words);
  console.log(`\n--- Batch ${batchNum}/${totalBatches}: ${words.length} words ---`);

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0.4,
    system: 'You are an IELTS vocabulary expert. Output ONLY valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('');
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('  JSON parse failed, repairing...');
    try {
      let repaired = jsonStr;
      const ob = (repaired.match(/\{/g) || []).length, cb = (repaired.match(/\}/g) || []).length;
      const obr = (repaired.match(/\[/g) || []).length, cbr = (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < ob - cb; i++) repaired += '}';
      for (let i = 0; i < obr - cbr; i++) repaired += ']';
      if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
      return JSON.parse(repaired);
    } catch (e2) {
      console.error('  Repair failed:', e.message);
      throw e;
    }
  }
}

async function main() {
  console.log('Loading data...');
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const allWords = [];
  data.forEach(root => {
    root.words.forEach(w => {
      if (!w.etymology || !w.mnemonic) {
        allWords.push(w);
      }
    });
  });

  console.log(`${allWords.length} words need etymology/mnemonic`);
  if (allWords.length === 0) { console.log('All done!'); return; }

  const batches = [];
  for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
    batches.push(allWords.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batches...`);
  let totalApplied = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      const enrichment = await enrichBatch(batches[i], i + 1, batches.length);
      const applied = applyEnrichment(data, batches[i], enrichment);
      totalApplied += applied;
      console.log(`  Batch ${i + 1}: enriched ${applied}/${batches[i].length} words`);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`  Batch ${i + 1} failed:`, err.message);
    }
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Total words enriched: ${totalApplied}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
