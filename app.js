(function () {
  const MOODS = ['All', 'Heartbreak', 'Anxiety', 'Family', 'Work', 'Loneliness', 'Just venting', 'Other'];
  const POST_MOODS = MOODS.slice(1);
  const CRISIS_PATTERNS = [/suicid/i, /kill myself/i, /end (it|my life)/i, /want to die/i, /hurt myself/i, /self[\s-]?harm/i, /no reason to live/i, /can'?t go on/i];

  let currentFilter = 'All';
  let currentSort = 'newest';
  let posts = [];
  let expandedReplies = new Set();
  let openReplyBoxes = new Set();

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function containsCrisisLanguage(text) {
    return CRISIS_PATTERNS.some(r => r.test(text));
  }

  // ---------------- Navigation ----------------
  function showPage(name) {
    ['home', 'browse', 'about'].forEach(p => {
      document.getElementById('page-' + p).hidden = (p !== name);
    });
    document.querySelectorAll('.nav-link[data-section]').forEach(b => {
      b.classList.toggle('active', b.dataset.section === name);
    });
    document.getElementById('mobileNav').classList.remove('open');
    if (name === 'browse') fetchPosts();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  document.querySelectorAll('.nav-link[data-section]').forEach(b => {
    b.addEventListener('click', () => showPage(b.dataset.section));
  });
  document.getElementById('goBrowse').addEventListener('click', () => showPage('browse'));
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('mobileNav').classList.toggle('open');
  });
  document.getElementById('scrollToCompose').addEventListener('click', () => {
    document.getElementById('compose').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('postText').focus();
  });

  // ---------------- Mood chips (compose) ----------------
  let selectedMood = null;
  const moodRow = document.getElementById('moodRow');
  POST_MOODS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = m;
    b.addEventListener('click', () => {
      selectedMood = m;
      Array.from(moodRow.children).forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      updateSubmitState();
    });
    moodRow.appendChild(b);
  });

  // ---------------- Filter chips (feed) ----------------
  const filterRow = document.getElementById('filterRow');
  MOODS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip' + (m === 'All' ? ' active' : '');
    b.type = 'button';
    b.textContent = m;
    b.addEventListener('click', () => {
      currentFilter = m;
      Array.from(filterRow.children).forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      fetchPosts();
    });
    filterRow.appendChild(b);
  });

  // ---------------- Sort menu ----------------
  const sortToggle = document.getElementById('sortToggle');
  const sortDropdown = document.getElementById('sortDropdown');
  sortToggle.addEventListener('click', () => sortDropdown.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sortDropdown.contains(e.target) && e.target !== sortToggle) sortDropdown.classList.remove('open');
  });
  sortDropdown.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      currentSort = b.dataset.sort;
      sortToggle.textContent = 'Sort: ' + (currentSort === 'newest' ? 'Newest' : 'Most discussed') + ' ▾';
      sortDropdown.classList.remove('open');
      fetchPosts();
    });
  });

  // ---------------- Compose ----------------
  const postText = document.getElementById('postText');
  const charCount = document.getElementById('charCount');
  const submitBtn = document.getElementById('submitPost');
  const crisisComposeBanner = document.getElementById('crisisComposeBanner');
  const composeError = document.getElementById('composeError');

  function updateSubmitState() {
    submitBtn.disabled = !(postText.value.trim().length > 0 && selectedMood);
  }
  postText.addEventListener('input', () => {
    charCount.textContent = postText.value.length;
    updateSubmitState();
    if (containsCrisisLanguage(postText.value)) {
      crisisComposeBanner.innerHTML = '<div class="crisis-banner"><strong>Before you post:</strong> if you\'re in danger or thinking about suicide, please talk to someone trained to help. <a href="#" id="inlineCrisisLink" style="color:var(--care);">See crisis resources</a> — or keep writing here if that feels right too.</div>';
      document.getElementById('inlineCrisisLink').addEventListener('click', (e) => { e.preventDefault(); openModal('crisisModal'); });
    } else {
      crisisComposeBanner.innerHTML = '';
    }
  });

  submitBtn.addEventListener('click', async () => {
    const text = postText.value.trim();
    if (!text || !selectedMood) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    composeError.textContent = '';
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood: selectedMood })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      postText.value = '';
      charCount.textContent = '0';
      selectedMood = null;
      Array.from(moodRow.children).forEach(c => c.classList.remove('active'));
      crisisComposeBanner.innerHTML = '';
      showPage('browse');
    } catch (e) {
      composeError.textContent = e.message;
    }
    submitBtn.textContent = 'Send anonymously';
    updateSubmitState();
  });

  // ---------------- Feed ----------------
  const feedList = document.getElementById('feedList');

  async function fetchPosts() {
    try {
      const params = new URLSearchParams({ mood: currentFilter, sort: currentSort });
      const res = await fetch('/api/posts?' + params.toString());
      posts = await res.json();
      renderFeed();
    } catch (e) {
      feedList.innerHTML = '<div class="empty-state">Couldn\'t reach the server. Please try again in a moment.</div>';
    }
  }

  function renderFeed() {
    feedList.innerHTML = '';
    if (!posts.length) {
      feedList.innerHTML = '<div class="empty-state"><img class="empty-state-logo" src="/logo-header.png" alt="">Nothing here yet. Be the first to share, or check back soon — someone might need to hear from you.</div>';
      return;
    }
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'post';
      el.innerHTML = `
        <div class="post-meta">
          <span class="post-mood">${escapeHtml(post.mood || 'Other')}</span>
          <span class="post-anon">${escapeHtml(post.anonName || 'Someone')}</span>
          <span>· ${timeAgo(post.createdAt || Date.now())}</span>
        </div>
        <div class="post-text">${escapeHtml(post.text || '')}</div>
        <div class="post-actions">
          <button class="link-btn" data-action="reply" data-id="${post.id}">Reply</button>
          <button class="link-btn" data-action="toggle-replies" data-id="${post.id}">${(post.replies||[]).length} ${(post.replies||[]).length === 1 ? 'reply' : 'replies'}</button>
          <button class="link-btn" data-action="flag" data-id="${post.id}">Flag</button>
        </div>
        <div class="replies" data-replies-for="${post.id}" style="display:none;"></div>
        <div class="reply-compose" data-reply-box-for="${post.id}">
          <textarea placeholder="Offer something kind or useful…" maxlength="800"></textarea>
          <div class="reply-compose-footer">
            <button class="btn btn-ghost btn-small" data-action="cancel-reply" data-id="${post.id}">Cancel</button>
            <button class="btn btn-primary btn-small" data-action="send-reply" data-id="${post.id}">Send reply</button>
          </div>
        </div>
      `;
      feedList.appendChild(el);

      const repliesContainer = el.querySelector('[data-replies-for="' + post.id + '"]');
      if (expandedReplies.has(post.id)) {
        repliesContainer.style.display = 'flex';
        repliesContainer.style.flexDirection = 'column';
        renderReplies(repliesContainer, post.replies || []);
      }
      const replyBox = el.querySelector('[data-reply-box-for="' + post.id + '"]');
      if (openReplyBoxes.has(post.id)) replyBox.classList.add('open');
    });
  }

  function renderReplies(container, replies) {
    container.innerHTML = '';
    if (!replies.length) {
      container.innerHTML = '<div class="reply-meta">No replies yet.</div>';
      return;
    }
    replies.forEach(r => {
      const rEl = document.createElement('div');
      rEl.innerHTML = `
        <div class="reply-meta"><span class="post-anon">${escapeHtml(r.anonName || 'Someone')}</span> · ${timeAgo(r.createdAt || Date.now())}</div>
        <div class="reply-text">${escapeHtml(r.text || '')}</div>
      `;
      container.appendChild(rEl);
    });
  }

  feedList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'toggle-replies') {
      if (expandedReplies.has(id)) expandedReplies.delete(id); else expandedReplies.add(id);
      renderFeed();
    } else if (action === 'reply') {
      if (openReplyBoxes.has(id)) openReplyBoxes.delete(id); else openReplyBoxes.add(id);
      expandedReplies.add(id);
      renderFeed();
    } else if (action === 'cancel-reply') {
      openReplyBoxes.delete(id);
      renderFeed();
    } else if (action === 'send-reply') {
      const box = document.querySelector('[data-reply-box-for="' + id + '"] textarea');
      const text = box.value.trim();
      if (!text) return;
      btn.disabled = true;
      try {
        const res = await fetch('/api/posts/' + id + '/replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error();
        openReplyBoxes.delete(id);
        expandedReplies.add(id);
        await fetchPosts();
      } catch (err) {
        btn.disabled = false;
      }
    } else if (action === 'flag') {
      btn.textContent = 'Reported';
      btn.classList.add('flagged');
      btn.disabled = true;
      try {
        await fetch('/api/posts/' + id + '/flag', { method: 'POST' });
      } catch (err) {}
    }
  });

  // ---------------- Modals ----------------
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  document.getElementById('navCrisisLink').addEventListener('click', (e) => { e.preventDefault(); openModal('crisisModal'); });
  document.getElementById('navCrisisLinkMobile').addEventListener('click', (e) => { e.preventDefault(); openModal('crisisModal'); });
  document.getElementById('openCrisisLink2').addEventListener('click', (e) => { e.preventDefault(); openModal('crisisModal'); });
  document.getElementById('closeCrisis').addEventListener('click', () => closeModal('crisisModal'));
  document.getElementById('openGuidelinesLink').addEventListener('click', (e) => { e.preventDefault(); openModal('guidelinesModal'); });
  document.getElementById('acceptGuidelines').addEventListener('click', () => {
    closeModal('guidelinesModal');
    try { localStorage.setItem('solace_seen_guidelines', '1'); } catch (e) {}
  });

  try {
    if (!localStorage.getItem('solace_seen_guidelines')) {
      setTimeout(() => openModal('guidelinesModal'), 400);
    }
  } catch (e) {}

  fetchPosts();
})();
