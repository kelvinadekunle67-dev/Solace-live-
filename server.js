const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------
// Storage: a JSON file on disk, with a write queue so concurrent
// requests never corrupt it. Fine for an MVP; swap for a real
// database (Postgres/Supabase) once traffic grows — see README.
// ---------------------------------------------------------------
let writeQueue = Promise.resolve();

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { posts: [] };
  }
}

function saveDB(data) {
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) reject(err); else resolve();
    });
  }));
  return writeQueue;
}

let db = loadDB();

function genId() {
  return randomBytes(8).toString('hex');
}

const ADJ = ['Quiet', 'Gentle', 'Wandering', 'Hushed', 'Steady', 'Weary', 'Hopeful', 'Tender', 'Calm', 'Restless'];
const NOUN = ['Fox', 'Sparrow', 'Willow', 'Harbor', 'Ember', 'Wren', 'Moth', 'River', 'Owl', 'Lantern'];
function makeAnonName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = 100 + Math.floor(Math.random() * 900);
  return `${a} ${n} #${num}`;
}

const MOODS = ['Heartbreak', 'Anxiety', 'Family', 'Work', 'Loneliness', 'Just venting', 'Other'];

// Basic abuse guardrails. Not a substitute for real moderation at scale
// (see README) but stops naive spam/flood scripts.
const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a little — try again in a few minutes.' }
});
const replyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a little — try again in a few minutes.' }
});

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.get('/api/moods', (req, res) => res.json(MOODS));

app.get('/api/posts', (req, res) => {
  const mood = req.query.mood;
  const sort = req.query.sort || 'newest';
  let posts = db.posts.filter(p => !p.hidden);
  if (mood && mood !== 'All') posts = posts.filter(p => p.mood === mood);
  posts = posts.slice();
  if (sort === 'discussed') {
    posts.sort((a, b) => (b.replies || []).length - (a.replies || []).length || b.createdAt - a.createdAt);
  } else {
    posts.sort((a, b) => b.createdAt - a.createdAt);
  }
  res.json(posts.slice(0, 200));
});

app.post('/api/posts', postLimiter, (req, res) => {
  const text = (req.body.text || '').trim();
  const mood = req.body.mood;
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Post must be 1-2000 characters.' });
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Invalid mood.' });
  const post = {
    id: genId(),
    text,
    mood,
    anonName: makeAnonName(),
    createdAt: Date.now(),
    replies: [],
    flagCount: 0,
    hidden: false
  };
  db.posts.push(post);
  saveDB(db).catch(() => {});
  res.json(post);
});

app.post('/api/posts/:id/replies', replyLimiter, (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post || post.hidden) return res.status(404).json({ error: 'Post not found.' });
  const text = (req.body.text || '').trim();
  if (!text || text.length > 800) return res.status(400).json({ error: 'Reply must be 1-800 characters.' });
  const reply = { id: genId(), text, anonName: makeAnonName(), createdAt: Date.now() };
  post.replies.push(reply);
  saveDB(db).catch(() => {});
  res.json(reply);
});

app.post('/api/posts/:id/flag', (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  post.flagCount = (post.flagCount || 0) + 1;
  if (post.flagCount >= 3) post.hidden = true;
  saveDB(db).catch(() => {});
  res.json({ ok: true, hidden: post.hidden });
});

app.listen(PORT, () => console.log(`Solace server listening on port ${PORT}`));
