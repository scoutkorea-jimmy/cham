/**
 * POST /api/admin/assist  { question, context: [{title, text}] }
 *
 * 관리자 도움말 챗봇. **설명서에서 찾은 대목만 근거로** 답한다.
 *
 * 왜 근거를 클라이언트가 보내는가 — 설명서 본문(assets/manual.html)은 이미 화면이
 * 들고 있다. 질문과 관련된 절만 골라 보내면 서버가 파일을 다시 읽을 필요가 없고,
 * 모델에 넘기는 양도 작아진다.
 *
 * 모델이 없거나 실패하면 200 으로 { answer: null } 을 준다 — 화면이 찾아 둔 절을
 * 그대로 보여 주면 되기 때문이다. 오류로 끝내면 운영자는 아무것도 못 얻는다.
 */
import { json, badRequest, methodNotAllowed, readJson } from '../../_shared/http.js';

/* 순서가 곧 응답 속도다 — 앞에서부터 시도하고 되는 것에서 멈춘다.
   같은 질문·같은 근거로 잰 값과 답의 정확도(2026-07-26):

     mistral-small-3.1-24b   2.5~3.2초  화면·버튼 이름을 그대로 짚어 단계로 답한다  ← 기본
     llama-3.3-70b-fp8-fast  1.2~3.1초  정확하지만 단계를 줄여 말한다
     qwen3-30b-a3b-fp8       3.8초      정확. **강조** 표기를 섞는다
     llama-3.2-3b            0.9초      가장 빠르지만 틀린 말을 한다 — 마지막 보험

   전에 쓰던 것들은 뺐다:
     qwen1.5-*, llama-3-8b   폐기됨(5028) — 매 질문마다 여기서 헛걸음했다
     llama-3.1-8b(비 fp8)    16.7초 · mistral-7b-v0.1  25.7초

   느렸던 진짜 이유가 이 목록이다. 폐기된 둘을 먼저 부르고 나서 16초짜리에 닿고 있었다.
   3b 를 앞에 두면 1초에 답하지만 "입금 확인이 안 된 주문은 배송준비중이 됩니다" 같은
   말을 지어낸다 — 처음 쓰는 사람이 그대로 따라 하는 화면이라 정확도를 먼저 본다. */
const MODELS = [
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
];
const MAX_Q = 300;
const MAX_CTX = 6000;
const MODEL_TIMEOUT_MS = 12_000;   // 응답 없는 모델에 매달려 있지 않는다

/* 한 번 된 모델을 기억한다. 같은 인스턴스가 살아 있는 동안은 앞의 것이 막혀도 다시 헛걸음하지 않는다.
   인스턴스가 바뀌면 초기값으로 돌아가는데, 그때는 MODELS 순서가 다시 답을 준다. */
let preferred = '';

function order() {
  if (!preferred) return MODELS;
  return [preferred].concat(MODELS.filter((m) => m !== preferred));
}

/* AI.run 이 응답하지 않는 경우가 있다 — 기다리다 전체가 죽느니 다음 모델로 넘어간다 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ' + ms + 'ms')), ms)),
  ]);
}

const SYSTEM = [
  '너는 한국참전통발효식품협동조합 홈페이지 관리자 화면의 도움말이다.',
  '아래 [설명서]에 적힌 내용만 근거로 한국어 존댓말로 답한다.',
  '',
  '규칙:',
  '- 설명서에 없는 내용은 지어내지 말고 "설명서에 없는 내용입니다. 담당자에게 문의해 주세요."라고 답한다.',
  '- 3~5문장으로 짧게. 순서가 있으면 1. 2. 3. 으로 나눈다.',
  '- 화면 이름(예: 주문 관리, 페이지 이미지)과 버튼 이름을 그대로 써서 어디를 눌러야 하는지 알려준다.',
  '- 컴퓨터에 익숙하지 않은 50~60대가 읽는다. 전문용어를 쓰지 않는다.',
].join('\n');

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest();

  const question = String(body.question || '').trim().slice(0, MAX_Q);
  if (!question) return badRequest('무엇이 궁금한지 적어 주세요.');

  const ctx = Array.isArray(body.context) ? body.context : [];
  if (!ctx.length) return json({ answer: null, reason: 'no_context' });

  // 모델이 붙어 있지 않은 환경(바인딩 누락 등)에서도 화면이 계속 동작해야 한다
  if (!env || !env.AI) return json({ answer: null, reason: 'no_model' });

  let used = 0;
  const passages = [];
  for (const c of ctx) {
    const t = `## ${String(c.title || '').slice(0, 80)}\n${String(c.text || '').replace(/\s+/g, ' ').trim()}`;
    if (used + t.length > MAX_CTX) break;
    used += t.length;
    passages.push(t);
  }

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `[설명서]\n${passages.join('\n\n')}\n\n[질문]\n${question}` },
  ];
  let lastErr = '';
  for (const model of order()) {
    try {
      const res = await withTimeout(
        env.AI.run(model, { messages, max_tokens: 420, temperature: 0.2 }),
        MODEL_TIMEOUT_MS,
      );
      const answer = String((res && (res.response || res.result || '')) || '').trim();
      if (answer) { preferred = model; return json({ answer, model }); }
      lastErr = 'empty';
    } catch (err) {
      lastErr = String((err && err.message) || err).slice(0, 200);
      if (preferred === model) preferred = '';   // 기억해 둔 모델이 막혔다 — 다시 순서대로
    }
  }
  // 전부 막혔다 — 근거 절은 화면이 이미 갖고 있으므로 그것만으로도 쓸 수 있다.
  // 관리자만 보는 응답이라 원인을 그대로 실어 준다(고칠 때 필요하다).
  return json({ answer: null, reason: 'model_error', detail: lastErr });
}

export const onRequestGet = methodNotAllowed;
