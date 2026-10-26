PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cms_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  revision INTEGER NOT NULL CHECK (revision > 0),
  published_json TEXT NOT NULL CHECK (json_valid(published_json)),
  published_revision INTEGER NOT NULL CHECK (published_revision > 0),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL,
  last_operation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_versions (
  id TEXT PRIMARY KEY,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  author TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_versions_created ON cms_versions(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS cms_media (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 8388608),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  created_at TEXT NOT NULL,
  author TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS cms_media_created ON cms_media(deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS cms_audit (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revision INTEGER,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS cms_audit_created ON cms_audit(created_at DESC, id DESC);
