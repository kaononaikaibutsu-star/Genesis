const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');
const { getEmbedding } = require('./ollama');

let db;
let uploadsDir;

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'genesis.db');
  uploadsDir = path.join(userDataPath, 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Vault Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      tags TEXT,
      attachments TEXT,
      embedding TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Activity & Habit Tracker Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      title TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categorized User Profile Table (Habits, Music, Movies, Hobbies)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      category TEXT PRIMARY KEY,
      insights TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function saveNote(title, content, tags, filePath) {
  let attachmentFileName = null;

  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    attachmentFileName = `${crypto.randomUUID()}${ext}`;
    const destination = path.join(uploadsDir, attachmentFileName);
    fs.copyFileSync(filePath, destination);
  }

  const textToEmbed = `${title} ${content || ''} ${tags || ''}`;
  const embeddingArray = await getEmbedding(textToEmbed);
  const embeddingJson = embeddingArray ? JSON.stringify(embeddingArray) : null;

  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO items (id, title, content, tags, attachments, embedding)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, title, content, tags, attachmentFileName, embeddingJson);
  return id;
}

function getAllNotes() {
  const stmt = db.prepare('SELECT id, title, content, tags, attachments, created_at FROM items ORDER BY created_at DESC');
  return stmt.all();
}

function deleteNote(id) {
  const selectStmt = db.prepare('SELECT attachments FROM items WHERE id = ?');
  const note = selectStmt.get(id);

  if (note && note.attachments) {
    const fileToDelete = path.join(uploadsDir, note.attachments);
    if (fs.existsSync(fileToDelete)) {
      fs.unlinkSync(fileToDelete);
    }
  }

  const deleteStmt = db.prepare('DELETE FROM items WHERE id = ?');
  deleteStmt.run(id);
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function semanticSearch(query, limit = 3) {
  const queryVector = await getEmbedding(query);
  if (!queryVector) return [];

  const stmt = db.prepare('SELECT * FROM items WHERE embedding IS NOT NULL');
  const allNotes = stmt.all();

  const results = allNotes.map(note => {
    const noteVector = JSON.parse(note.embedding);
    const similarity = cosineSimilarity(queryVector, noteVector);
    return { ...note, similarity };
  });

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

module.exports = {
  initDatabase,
  saveNote,
  getAllNotes,
  deleteNote,
  semanticSearch,
  uploadsDir
};