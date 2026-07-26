-- 목록 버전 — 동시 편집으로 남의 작업이 사라지는 것을 막는다.
--
-- 목록 저장은 '통째로 교체'다. 두 사람이 같은 시점의 목록을 각자 읽고 각자 저장하면
-- 나중 저장이 앞 사람 작업을 조용히 되돌린다(실제로 재현했다 — A 가 만든 팝업이 사라졌다).
--
-- 저장할 때 '내가 읽은 버전'을 함께 보내게 하고, 그 사이에 버전이 올라갔으면 거절한다.
-- 누가 언제 바꿨는지도 남겨 "누가 방금 바꿨습니다"라고 알려 줄 수 있게 한다.

CREATE TABLE IF NOT EXISTS list_versions (
  kind        TEXT PRIMARY KEY,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT                                   -- 표시 이름(없으면 아이디)
);

-- 이미 자료가 있는 항목도 버전 1 에서 시작한다.
INSERT OR IGNORE INTO list_versions (kind, version) VALUES
  ('orders', 1), ('applications', 1), ('inquiries', 1), ('products', 1), ('posts', 1),
  ('cohorts', 1), ('partners', 1), ('popups', 1),
  ('settings', 1), ('consents', 1), ('kms', 1);
