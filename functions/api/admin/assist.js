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

/* 쓸 수 있는 모델은 계정·시점에 따라 다르다. 하나가 막히면 다음 것으로 넘어간다 —
   챗봇이 통째로 죽는 것보다 낫다. 앞쪽일수록 한국어 응답이 낫다. */
const MODELS = [
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.1',
];
const MAX_Q = 300;
const MAX_CTX = 6000;

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
  const list = body.model ? [body.model] : MODELS;   // 진단용 — 특정 모델만 시험
  for (const model of list) {
    try {
      const res = await env.AI.run(model, { messages, max_tokens: 420, temperature: 0.2 });
      const answer = String((res && (res.response || res.result || '')) || '').trim();
      if (answer) return json({ answer, model });
      lastErr = 'empty';
    } catch (err) {
      lastErr = String((err && err.message) || err).slice(0, 200);
    }
  }
  // 전부 막혔다 — 근거 절은 화면이 이미 갖고 있으므로 그것만으로도 쓸 수 있다.
  // 관리자만 보는 응답이라 원인을 그대로 실어 준다(고칠 때 필요하다).
  return json({ answer: null, reason: 'model_error', detail: lastErr });
}

export const onRequestGet = methodNotAllowed;
