-- cham · 0002 운영 데이터 (주문 · 신청 · 문의 · 상품 · 게시글 · 설정 · 이미지)
-- 적용:  npx wrangler d1 execute cham-db --local  --file=db/0002_data.sql
-- 운영:  npx wrangler d1 execute cham-db --remote --file=db/0002_data.sql
--
-- 설계 원칙
--   · id 는 기존 localStorage 데이터의 문자열 id 를 그대로 쓴다(백업 JSON 을 손대지 않고 넣기 위해).
--   · 구조가 깊은 값(상품 option/gosi/related, 주문 원본)은 정규화하지 않고 JSON 열(doc/payload)에 둔다.
--     클라이언트가 지금 쓰는 객체 모양을 유지해 이전 위험을 줄인다.
--     검색·정렬·집계에 쓰는 값만 별도 열로 뽑는다.
--   · 시각은 ISO8601 문자열(created_at)로 통일 — 기존 rec.at 과 같은 형식이라 변환이 없다.

-- ── 주문 (제품 주문 + 씨장 분양) ─────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  order_no      TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'order',   -- order | seedjang
  status        TEXT NOT NULL DEFAULT '주문접수',
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  product_id    TEXT,
  product_name  TEXT,
  option_label  TEXT,
  qty           INTEGER,
  unit_price    INTEGER,
  total         INTEGER,
  depositor     TEXT,
  pay_method    TEXT,
  ship_method   TEXT,
  courier       TEXT,
  tracking      TEXT,
  cancel_reason TEXT,
  rma_reason    TEXT,
  pickup_addr   TEXT,
  payload       TEXT NOT NULL DEFAULT '{}',      -- 위 열에 없는 나머지(request·region·memo·amount 등)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 비회원 조회는 주문번호로 찾는다. 같은 번호가 두 번 나오지 않게 유니크.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ── 지도사 신청 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  phone      TEXT,
  region     TEXT,
  course     TEXT,
  memo       TEXT,
  status     TEXT NOT NULL DEFAULT '신규',
  admin_memo TEXT,
  handled_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_created ON applications(created_at DESC);

-- ── 문의 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  phone      TEXT,
  type       TEXT,
  memo       TEXT,
  status     TEXT NOT NULL DEFAULT '신규',
  admin_memo TEXT,
  handled_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries(created_at DESC);

-- ── 상품 ────────────────────────────────────────────────────
-- doc 에 option·gosi·related·descHtml·icon·tone·photo 를 통째로 둔다.
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  cat              TEXT,
  price            INTEGER NOT NULL DEFAULT 0,
  sale_price       INTEGER,
  unit             TEXT,
  status           TEXT NOT NULL DEFAULT '판매중',
  stock            INTEGER NOT NULL DEFAULT 0,
  summary          TEXT,
  price_on_request INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  doc              TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(cat, sort_order);

-- ── 게시글 (소식마당) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY,
  cat        TEXT NOT NULL DEFAULT '공지',
  title      TEXT NOT NULL,
  html       TEXT,
  badge      TEXT,
  important  INTEGER NOT NULL DEFAULT 0,
  sample     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_cat ON posts(cat, created_at DESC);

-- ── 단순 목록 (기수 · 파트너 · 팝업) ─────────────────────────
-- 열을 따로 뽑을 이유가 없을 만큼 작고 통째로 읽고 쓴다 → 한 표에 kind 로 구분.
CREATE TABLE IF NOT EXISTS collections (
  kind       TEXT NOT NULL,          -- cohorts | partners | popups
  id         TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  doc        TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, id)
);

-- ── 단일 문서 (설정 · 동의문 · KMS) ──────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  key        TEXT PRIMARY KEY,       -- settings | consents | kms
  doc        TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── 이미지 (실물은 R2, 여기엔 키와 메타만) ───────────────────
--   scope  product | page | post | gallery
--   ref    product → 상품 id / page → 슬롯 id / post → 게시글 id
--   role   product → main|extra|detail
--   pcx…   page 전용 — PC·모바일 초점 위치(0~100%)
CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,
  scope      TEXT NOT NULL,
  ref        TEXT,
  role       TEXT,
  ord        INTEGER NOT NULL DEFAULT 0,
  r2_key     TEXT NOT NULL,
  mime       TEXT,
  size       INTEGER,
  name       TEXT,
  pcx        INTEGER, pcy INTEGER, mbx INTEGER, mby INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_scope_ref ON images(scope, ref, ord);

-- ── 방문 통계 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  day TEXT PRIMARY KEY,             -- YYYY-MM-DD
  pv  INTEGER NOT NULL DEFAULT 0,
  uv  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS visit_sources (
  kind TEXT PRIMARY KEY,            -- 직접 방문 | 검색엔진 | 소셜·블로그 | 기타 사이트
  n    INTEGER NOT NULL DEFAULT 0
);
