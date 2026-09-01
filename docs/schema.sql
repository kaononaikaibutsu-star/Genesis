-- Project Genesis: SQLite Core Schema Definition
-- 1. Main Vault Items Table
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,               -- Unique identifier (UUID)
    title TEXT NOT NULL,               -- Title of note/entry
    content TEXT,                      -- Raw body text, markdown, or code
    type TEXT NOT NULL,                -- 'note', 'task', 'code', 'audio', 'journal', 'link'
    file_path TEXT,                    -- Path if linking to local media/files
    is_favorite INTEGER DEFAULT 0,     -- 0 = false, 1 = true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 3. Item <-> Tag Junction Table
CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT,
    tag_id TEXT,
    PRIMARY KEY (item_id, tag_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 4. Knowledge Graph Relationships Table
CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,           -- Starting node (e.g., Book ID)
    target_id TEXT NOT NULL,           -- Connected node (e.g., Project ID)
    relation_type TEXT NOT NULL,       -- E.g., 'INSPIRES', 'CREATED_IN', 'DEPENDS_ON'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES items(id) ON DELETE CASCADE
);