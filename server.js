const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables. Set these in your Render dashboard under Environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ADJ = ['Quiet', 'Gentle', 'Wandering', 'Hushed', 'Steady', 'Weary', 'Hopeful', 'Tender', 'Calm', 'Restless'];
const NOUN = ['Fox', 'Sparrow', 'Willow', 'Harbor', 'Ember', 'Wren', 'Moth', 'River', 'Owl', 'Lantern'];
function makeAnonName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = 100 + Math.floor(Math.random() * 900);
  return `${a} ${n} #${num}`;
}

const MOODS = ['Heartbreak', 'Anxiety', 'Family', 'Work', 'Loneliness', 'Just venting', 'Other'];

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

function shapePost(p) {
  return {
    id: p.id,
    text: p.text,
    mood: p.mood,
    anonName: p.anon_name,
    createdAt: new Date(p.created_at).getTime(),
    flagCount: p.flag_count,
    hidden: p.hidden,
    replies: (p.replies || [])
      .map(r => ({ id: r.id, text: r.text, anonName: r.anon_name, createdAt: new Date(r.created_at).getTime() }))
      .sort((a, b) => a.createdAt - b.createdAt)
  };
}

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.get('/api/moods', (req, res) => res.json(MOODS));

app.get('/api/posts', async (req, res) => {
  const mood = req.query.mood;
  const sort = req.query.sort || 'newest';

  let query = supabase.from('posts').select('*, replies(*)').eq('hidden', false);
  if (mood && mood !== 'All') query = query.eq('mood', mood);

  const { data, error } = await query;
  if (error) {
    console.error('Fetch posts failed:', error.message);
    return res.status(500).json({ error: 'Could not load posts.' });
  }

  let posts = data.map(shapePost);
  if (sort === 'discussed') {
    posts.sort((a, b) => b.replies.length - a.replies.length || b.createdAt - a.createdAt);
  } else {
    posts.sort((a, b) => b.createdAt - a.createdAt);
  }
  res.json(posts.slice(0, 200));
});

app.post('/api/posts', postLimiter, async (req, res) => {
  const text = (req.body.text || '').trim();
  const mood = req.body.mood;
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Post must be 1-2000 characters.' });
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Invalid mood.' });

  const { data, error } = await supabase
    .from('posts')
    .insert({ text, mood, anon_name: makeAnonName() })
    .select()
    .single();

  if (error) {
    console.error('Insert post failed:', error.message);
    return res.status(500).json({ error: 'Could not save that post.' });
  }
});

app.post('/api/posts/:id/replies', replyLimiter, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text || text.length > 800) return res.status(400).json({ error: 'Reply must be 1-800 characters.' });

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, hidden')
    .eq('id', req.params.id)
    .single();
  if (postErr || !post || post.hidden) return res.status(404).json({ error: 'Post not found.' });

  const { data, error } = await supabase
    .from('replies')
    .insert({ post_id: req.params.id, text, anon_name: makeAnonName() })
    .select()
    .single();
  if (error) {
    console.error('Insert reply failed:', error.message);
    return res.status(500).json({ error: 'Could not save that reply.' });
  }

  res.json({ id: data.id, text: data.text, anonName: data.anon_name, createdAt: new Date(data.created_at).getTime() });
});

app.post('/api/posts/:id/flag', async (req, res) => {
  const { data: post, error: getErr } = await supabase
    .from('posts')
    .select('flag_count')
    .eq('id', req.params.id)
    .single();
  if (getErr || !post) return res.status(404).json({ error: 'Post not found.' });

  const newFlags = (post.flag_count || 0) + 1;
  const update = { flag_count: newFlags };
  if (newFlags >= 3) update.hidden = true;

  const { error } = await supabase.from('posts').update(update).eq('id', req.params.id);
  if (error) {
    console.error('Flag update failed:', error.message);
    return res.status(500).json({ error: 'Could not flag that post.' });
  }

  res.json({ ok: true, hidden: newFlags >= 3 });
});

app.listen(PORT, () => console.log(`Solace server listening on port ${PORT}`));
