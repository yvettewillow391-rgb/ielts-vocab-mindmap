// gen_tips2.js — Generate expanded vocabulary tips
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

const prompt = `You are an IELTS vocabulary expert creating a comprehensive Chinese-language reference for students. Write in Chinese with English examples. Return ONLY valid JSON.

Generate the following additional vocabulary tip categories:

## 1. 常见前缀大全 (Common Prefixes beyond negatives)
Categorize by function:
- 时间顺序: pre-(前), post-(后), ante-(在前), fore-(预先), mid-(中间), re-(再次)
- 空间位置: inter-(之间), intra-(内部), trans-(跨越), circum-(周围), sub-(下面), super-(上面), under-(在下), over-(在上)
- 程度大小: super-(超级), ultra-(极端), hyper-(过度), macro-(宏大), micro-(微小), mini-(小型), semi-/hemi-(半)
- 关系态度: co-/col-/com-/con-(共同), counter-/contra-(反对), pro-(支持), anti-(反对), syn-/sym-(同步)
- 其他常用: multi-(多), poly-(多), auto-(自己), bio-(生命), geo-(地球), tele-(远程), photo-(光)

Each prefix needs: prefix, meaning, 3-5 example words with Chinese translations.

## 2. 雅思同义词替换 (IELTS Synonym Groups)
Common synonym groups tested in IELTS Writing Task 2 and Speaking. Group by topic:
- 重要的 (important): significant, crucial, vital, essential, paramount, indispensable
- 认为 (think): believe, argue, maintain, contend, assert, hold the view
- 导致 (cause): lead to, result in, give rise to, bring about, contribute to
- 解决 (solve): address, tackle, resolve, cope with, deal with
- 许多 (many): numerous, a multitude of, a host of, a plethora of, considerable
- 好的 (good): beneficial, advantageous, favorable, positive, desirable
- 坏的 (bad): detrimental, adverse, harmful, negative, undesirable
- 增加 (increase): rise, soar, surge, escalate, proliferate
- 减少 (decrease): decline, diminish, dwindle, plummet, shrink
- 重要的 (show): demonstrate, illustrate, indicate, reveal, suggest

Each group: Chinese topic, list of synonyms with word + Chinese meaning + example sentence in IELTS context.

## 3. 学术写作高频词汇 (Academic Word List)
Group by usage in IELTS Task 2 essays:
- 观点表达: advocate, contend, assert, maintain, postulate
- 论证连接: furthermore, moreover, consequently, nonetheless, whereas
- 趋势描述: fluctuate, stabilize, plateau, peak, decline
- 程度修饰: significantly, considerably, substantially, marginally, moderately
- 论证强度: undoubtedly, inevitably, invariably, presumably, arguably

Each word: Chinese meaning, common IELTS collocation, example sentence.

## 4. 易错拼写 (Commonly Misspelled Words)
Words that Chinese students often misspell, grouped by pattern:
- Double letters: accommodate, committee, embarrass, possession, occurred
- Silent letters: foreign, campaign, psychology, debt, subtle
- ie/ei confusion: achieve, receive, believe, ceiling, perceive
- -ance/-ence confusion: independence, appearance, reference, attendance
- Others: separate, definitely, necessary, phenomenon, bureaucracy

Each: correct spelling, common mistake, Chinese meaning, memory tip.

## 5. 一词多义 (Polysemous Words)
Common IELTS words with multiple meanings that students often confuse:
- address: 地址 / 解决 / 演讲
- figure: 数字 / 人物 / 身材 / 图形
- account: 账户 / 描述 / 解释(account for)
- charge: 收费 / 指控 / 负责 / 充电
- critical: 批评的 / 关键的
- novel: 小说 / 新颖的
- sound: 声音 / 合理的 / 听起来
- fine: 好的 / 罚款 / 细微的
- apply: 申请 / 应用 / 适用于
- subject: 主题 / 学科 / 受...支配的

Each word: all meanings with Chinese translations, example sentences for each meaning.

Return ONLY valid JSON:
{
  "tips": {
    "common_prefixes": [...],
    "synonym_groups": [...],
    "academic_words": [...],
    "misspelled": [...],
    "polysemous": [...]
  }
}`;

async function main() {
  console.log('Generating expanded tips...');
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
    // Merge with existing tips
    const existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'tips.json'), 'utf8'));
    existing.tips = { ...existing.tips, ...data.tips };
    fs.writeFileSync(path.join(__dirname, 'tips.json'), JSON.stringify(existing, null, 2), 'utf8');
    // Update tips-data.js
    fs.writeFileSync(path.join(__dirname, 'tips-data.js'), 'window.__TIPS__ = ' + JSON.stringify(existing.tips, null, 2) + ';', 'utf8');
    console.log('Tips expanded and saved. Categories:', Object.keys(existing.tips).join(', '));
  } catch(e) {
    console.error('JSON parse failed:', e.message);
    console.log('Raw text:', jsonStr.substring(0, 500));
    throw e;
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
