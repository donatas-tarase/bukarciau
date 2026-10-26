const newId = () => crypto.randomUUID().replaceAll('-', '');
const now = () => new Date().toISOString();
const changed = result => Number(result?.meta?.changes ?? result?.changes ?? 0) > 0;

// This condition executes in the same transaction as the content update. A photo
// cannot disappear between validation and saving a new draft that references it.
const validMedia = `NOT EXISTS (
  SELECT 1 FROM json_tree(?) AS refs
  LEFT JOIN cms_media AS media ON '/media/' || media.id = refs.value
  WHERE refs.type = 'text' AND refs.value LIKE '/media/%'
    AND (media.id IS NULL OR media.deleted_at IS NOT NULL)
)`;

export class CmsStore {
  constructor(db, initialContent) {
    this.db = db;
    this.initialContent = initialContent;
  }

  async state() {
    let row = await this.db.prepare('SELECT * FROM cms_state WHERE id = 1').first();
    if (!row) {
      const timestamp = now();
      const seed = JSON.stringify(this.initialContent);
      await this.db.batch([
        this.db.prepare(`INSERT OR IGNORE INTO cms_state
          (id, draft_json, revision, published_json, published_revision, updated_at, updated_by, published_at, published_by, last_operation)
          VALUES (1, ?, 1, ?, 1, ?, 'system', ?, 'system', 'seed')`).bind(seed, seed, timestamp, timestamp),
        this.db.prepare(`INSERT OR IGNORE INTO cms_versions (id, content_json, revision, created_at, author)
          SELECT '00000000000000000000000000000000', published_json, published_revision, published_at, published_by
          FROM cms_state WHERE id = 1`),
      ]);
      row = await this.db.prepare('SELECT * FROM cms_state WHERE id = 1').first();
    }
    return {
      content: JSON.parse(row.draft_json),
      published: JSON.parse(row.published_json),
      revision: row.revision,
      publishedRevision: row.published_revision,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      publishedAt: row.published_at,
      publishedBy: row.published_by,
    };
  }

  async saveDraft(content, revision, author, { restore = false, imageIds = [] } = {}) {
    const timestamp = now();
    const operation = newId();
    const json = JSON.stringify(content);
    const statements = [];
    if (restore && imageIds.length) {
      const marks = imageIds.map(() => '?').join(',');
      statements.push(this.db.prepare(`UPDATE cms_media SET deleted_at = NULL
        WHERE id IN (${marks}) AND EXISTS (SELECT 1 FROM cms_state WHERE id = 1 AND revision = ?)`)
        .bind(...imageIds, revision));
    }
    const index = statements.length;
    statements.push(
      this.db.prepare(`UPDATE cms_state SET draft_json = ?, revision = revision + 1, updated_at = ?, updated_by = ?, last_operation = ?
        WHERE id = 1 AND revision = ? AND ${validMedia}`).bind(json, timestamp, author, operation, revision, json),
      this.db.prepare(`INSERT INTO cms_audit (id, event, author, created_at, revision, detail)
        SELECT ?, ?, ?, ?, revision, NULL FROM cms_state WHERE id = 1 AND last_operation = ?`)
        .bind(operation, restore ? 'restore-draft' : 'save-draft', author, timestamp, operation),
      this.db.prepare('DELETE FROM cms_audit WHERE id NOT IN (SELECT id FROM cms_audit ORDER BY created_at DESC, id DESC LIMIT 500)'),
    );
    const results = await this.db.batch(statements);
    return changed(results[index]);
  }

  async publish(revision, author) {
    const timestamp = now();
    const operation = newId();
    const results = await this.db.batch([
      this.db.prepare(`UPDATE cms_state SET published_json = draft_json, published_revision = revision,
        published_at = ?, published_by = ?, updated_at = ?, updated_by = ?, last_operation = ?
        WHERE id = 1 AND revision = ? AND published_revision != revision`)
        .bind(timestamp, author, timestamp, author, operation, revision),
      this.db.prepare(`INSERT INTO cms_versions (id, content_json, revision, created_at, author)
        SELECT ?, published_json, published_revision, ?, ? FROM cms_state WHERE id = 1 AND last_operation = ?`)
        .bind(operation, timestamp, author, operation),
      this.db.prepare(`INSERT INTO cms_audit (id, event, author, created_at, revision, detail)
        SELECT ?, 'publish', ?, ?, published_revision, NULL FROM cms_state WHERE id = 1 AND last_operation = ?`)
        .bind(operation, author, timestamp, operation),
      this.db.prepare('DELETE FROM cms_versions WHERE id NOT IN (SELECT id FROM cms_versions ORDER BY created_at DESC, rowid DESC LIMIT 30)'),
      this.db.prepare('DELETE FROM cms_audit WHERE id NOT IN (SELECT id FROM cms_audit ORDER BY created_at DESC, id DESC LIMIT 500)'),
    ]);
    return changed(results[0]);
  }

  async history() {
    const result = await this.db.prepare('SELECT id, revision, created_at AS createdAt, author FROM cms_versions ORDER BY created_at DESC, rowid DESC LIMIT 30').all();
    return result.results || [];
  }

  async version(id) {
    const row = await this.db.prepare('SELECT content_json FROM cms_versions WHERE id = ?').bind(id).first();
    return row ? JSON.parse(row.content_json) : null;
  }

  async media(id) {
    return this.db.prepare('SELECT * FROM cms_media WHERE id = ?').bind(id).first();
  }

  async mediaList() {
    const result = await this.db.prepare('SELECT * FROM cms_media WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 500').all();
    return result.results || [];
  }

  async addMedia(item) {
    await this.db.batch([
      this.db.prepare(`INSERT INTO cms_media (id, name, content_type, size, width, height, created_at, author)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(item.id, item.name, item.content_type, item.size, item.width, item.height, item.created_at, item.author),
      this.db.prepare(`INSERT INTO cms_audit (id, event, author, created_at, detail)
        VALUES (?, 'upload-media', ?, ?, ?)`)
        .bind(newId(), item.author, item.created_at, item.id),
    ]);
  }

  async deleteMedia(id, author) {
    const operation = newId();
    const timestamp = now();
    const url = `/media/${id}`;
    const results = await this.db.batch([
      this.db.prepare(`UPDATE cms_media SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM cms_state, json_tree(cms_state.draft_json) AS refs WHERE refs.value = ?)
        AND NOT EXISTS (SELECT 1 FROM cms_state, json_tree(cms_state.published_json) AS refs WHERE refs.value = ?)`)
        .bind(timestamp, id, url, url),
      this.db.prepare(`INSERT INTO cms_audit (id, event, author, created_at, detail)
        SELECT ?, 'delete-media', ?, ?, id FROM cms_media WHERE id = ? AND deleted_at = ?`)
        .bind(operation, author, timestamp, id, timestamp),
    ]);
    return changed(results[0]);
  }
}
