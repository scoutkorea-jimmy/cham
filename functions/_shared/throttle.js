/**
 * IP 단위 지수 백오프. **두 가지 일에 쓴다.**
 *
 *  1. **맞히기 방지**(로그인·아이디찾기) — *틀렸을 때만* `fail()` 을 부른다.
 *     맞히면 `clear()` 로 되돌린다. 정상 이용자는 한 번에 맞히므로 아무 영향이 없다.
 *  2. **제출 빈도 제한**(가입·주문·문의) — *성공·실패를 가리지 않고* `count()` 를 부른다.
 *     여기엔 '틀림'이 없다. 한 곳에서 쏟아붓는 것 자체가 막을 대상이다.
 *
 * 같은 장치를 쓰는 이유는, 둘 다 "한 IP 가 짧은 시간에 몇 번 왔나"를 세는 일이기
 * 때문이다. 세는 규칙이 둘이 되면 한쪽만 고쳐지는 날이 온다.
 *
 * **계정 단위로 잠그지 않는다.** 남의 아이디로 일부러 틀려 그 사람을 잠글 수 있고,
 * 그러면 계정 잠금 자체가 공격 수단이 된다.
 *
 * 저장은 `admin_login_attempts` 표를 함께 쓰되 **키에 접두사를 붙여 서로 격리한다.**
 * 표를 새로 만들 이유가 없고, 무엇보다 회원 쪽 실패가 관리자 로그인을 잠그면 안 된다
 * (같은 사무실에서 손님용 화면을 만지다 관리자가 못 들어가는 일이 생긴다).
 *
 * 접두사: `m:` 회원 로그인 / `f:` 아이디 찾기 / `s:` 가입 / `q:` 공개 양식 접수 /
 *         (관리자 로그인은 접두사 없이 IP 그대로)
 *
 * > **한 IP 를 여럿이 나눠 쓴다.** 통신사 NAT·사무실·학교가 그렇다. 그래서 빈도 제한의
 * > `freeAttempts` 는 넉넉히 잡는다 — 스크립트를 쓸모없게 만들면 충분하고,
 * > 옆 사람 때문에 손님이 주문을 못 하는 편이 훨씬 나쁘다.
 */

const IDLE_RESET_SECONDS = 24 * 60 * 60;

export function makeThrottle({ prefix, freeAttempts = 5, baseDelay = 30, maxDelay = 60 * 60 }) {
  const requiredDelay = (count) => {
    if (count < freeAttempts) return 0;
    const power = Math.min(count - freeAttempts, 12);
    return Math.min(baseDelay * 2 ** power, maxDelay);
  };

  const keyOf = (request) => prefix + (request.headers.get('CF-Connecting-IP') || 'unknown');

  async function read(env, key) {
    try {
      const row = await env.DB.prepare(
        `SELECT attempt_count, first_attempt_at, last_attempt_at FROM admin_login_attempts WHERE ip = ?`
      ).bind(key).first();
      if (!row) return { count: 0, first: 0, last: 0 };
      return {
        count: Number(row.attempt_count) || 0,
        first: Number(row.first_attempt_at) || 0,
        last: Number(row.last_attempt_at) || 0,
      };
    } catch { return { count: 0, first: 0, last: 0 }; }
  }

  async function clear(env, key) {
    try { await env.DB.prepare(`DELETE FROM admin_login_attempts WHERE ip = ?`).bind(key).run(); } catch {}
  }

  async function fail(env, key) {
    const now = Math.floor(Date.now() / 1000);
    try {
      const prev = await read(env, key);
      await env.DB.prepare(
        `INSERT INTO admin_login_attempts (ip, attempt_count, first_attempt_at, last_attempt_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(ip) DO UPDATE SET
           attempt_count    = excluded.attempt_count,
           first_attempt_at = excluded.first_attempt_at,
           last_attempt_at  = excluded.last_attempt_at`
      ).bind(key, prev.count + 1, prev.count > 0 && prev.first ? prev.first : now, now).run();
    } catch { /* 카운터를 못 적었다고 요청 자체를 막지는 않는다 */ }
  }

  /**
   * 지금 받아 줄 수 있는지 본다.
   * 막아야 하면 { retryAfter } 를, 받아도 되면 null 을 돌려준다.
   */
  async function check(request, env) {
    const key = keyOf(request);
    const now = Math.floor(Date.now() / 1000);
    let att = await read(env, key);
    // 하루 조용했으면 처음부터 — 오래전 오타 때문에 오늘 못 들어가면 안 된다
    if (att.count > 0 && att.last && now - att.last >= IDLE_RESET_SECONDS) {
      await clear(env, key);
      att = { count: 0, first: 0, last: 0 };
    }
    if (att.count >= freeAttempts && att.last) {
      const earliest = att.last + requiredDelay(att.count);
      if (now < earliest) return { retryAfter: earliest - now };
    }
    return null;
  }

  return {
    keyOf,
    check,
    fail: (request, env) => fail(env, keyOf(request)),
    /* fail() 과 같은 일을 한다. 이름만 다르다 —
       빈도 제한에서 부르는 자리에 `fail` 이라고 적혀 있으면, 읽는 사람이
       '무엇이 실패했지?' 하고 멈춘다. 성공한 주문에도 부르는 자리다. */
    count: (request, env) => fail(env, keyOf(request)),
    clear: (request, env) => clear(env, keyOf(request)),
  };
}
