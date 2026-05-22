// gen_tips.js — Generate IELTS vocabulary tips (noun/adjective/verb suffixes, negative prefixes)
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

const prompt = `You are an IELTS vocabulary expert. Create a comprehensive, well-organized reference guide for Chinese-speaking IELTS students about English word formation patterns. Write in Chinese with English examples.

Cover these categories in detail:

## 1. 名词后缀 (Noun Suffixes)
List common noun suffixes with their meanings and 3-4 example words each. Include:
- -tion/-sion (动作/状态)
- -ment (行为/结果)
- -ness (性质/状态)
- -ity/-ty (性质)
- -ance/-ence (状态/性质)
- -er/-or/-ist (做...的人)
- -ism (主义/学说)
- -ship (关系/状态)
- -hood (身份/时期)
- -ure (动作/结果)

## 2. 形容词后缀 (Adjective Suffixes)
- -able/-ible (能...的)
- -al/-ial (属于...的)
- -ful (充满...的)
- -less (没有...的)
- -ous/-ious (具有...性质的)
- -ive (有...倾向的)
- -ic/-ical (与...相关的)
- -ant/-ent (...的)
- -ary/-ory (与...有关的)
- -ish (有点...的)

## 3. 动词后缀 (Verb Suffixes)
- -ate (使成为)
- -ify/-fy (使...化)
- -ize/-ise (使...化)
- -en (使变得)

## 4. 否定前缀 (Negative Prefixes) — THIS IS MOST IMPORTANT, be very detailed
Explain the rules for which prefix to use, with many examples:
- un- (最常用，用于大多数形容词、分词) — with word list
- in- (用于以 -ate, -ent, -ible 等结尾的拉丁词) — with word list
- im- (用于以 m-, p-, b- 开头的词) — with word list
- il- (用于以 l- 开头的词) — with word list
- ir- (用于以 r- 开头的词) — with word list
- dis- (用于动词、名词，表示"相反"或"去除") — with word list
- non- (表示"非"，较中性) — with word list
- mis- (表示"错误地") — with word list
- anti- (表示"反对") — with word list
- de- (表示"去除、向下") — with word list
- a-/an- (表示"无、不") — with word list

## 5. 常见词根分类 (Common Roots by Category)
Group common roots by meaning category:
- 身体部位相关 (body parts): cap/head, man/hand, ped/foot, corp/body, etc.
- 自然现象 (nature): aqua/water, terr/earth, astro/star, etc.
- 动作相关 (actions): tract/pull, mit/send, ject/throw, etc.
- 数量大小 (quantity): mono/one, bi/two, poly/many, magn/large, etc.
- 思维感知 (mind/senses): spect/look, aud/hear, dict/say, etc.

## 6. 易混词根辨析 (Easily Confused Roots)
- -clude (clud/clus = close): include vs exclude vs conclude vs preclude
- -tain (tain/ten = hold): contain vs maintain vs retain vs sustain
- -vert (vert/vers = turn): convert vs revert vs invert vs divert
- -duct (duct = lead): conduct vs produce vs reduce vs introduce

Return ONLY valid JSON in this exact format:
{
  "tips": {
    "noun_suffixes": [
      {"suffix": "-tion/-sion", "meaning": "表示动作、状态或结果", "examples": ["education 教育", "decision 决定", "information 信息", "discussion 讨论"]}
    ],
    "adjective_suffixes": [...],
    "verb_suffixes": [...],
    "negative_prefixes": [
      {"prefix": "un-", "rule": "最常用，用于大多数形容词和分词", "examples": ["unhappy 不快乐", "unusual 不寻常", "unemployment 失业", "unbelievable 难以置信"]}
    ],
    "common_roots": [
      {"category": "身体部位", "roots": [{"root": "cap/cephal", "meaning": "头", "examples": ["capital 首都", "captain 队长", "chapter 章节"]}]}
    ],
    "confused_roots": [
      {"group": "-clude (clud/clus = 关闭)", "words": [{"word": "include", "meaning": "包含", "note": "in(进入)+clude→关进去→包含"}, {"word": "exclude", "meaning": "排除", "note": "ex(外)+clude→关在外面→排除"}]}
    ]
  }
}

Make the content thorough, exam-relevant, and easy to understand for Chinese students. Include LOTS of examples.`;

async function main() {
  console.log('Generating vocabulary tips...');
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 16384,
    temperature: 0.3,
    system: 'You are an IELTS vocabulary expert. Output ONLY valid JSON, no other text.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('');
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const data = JSON.parse(jsonStr);
    fs.writeFileSync(path.join(__dirname, 'tips.json'), JSON.stringify(data, null, 2), 'utf8');
    console.log('Saved to tips.json');
  } catch(e) {
    console.error('JSON parse failed:', e.message);
    console.log('Raw text:', jsonStr.substring(0, 500));
    throw e;
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
