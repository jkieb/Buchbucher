const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const loginPanel = document.querySelector('#login-panel');
const profilePanel = document.querySelector('#profile-panel');
const profileName = document.querySelector('#profile-name');
const profilePhase = document.querySelector('#profile-phase');
const profilePalettes = document.querySelector('#profile-palettes');
const profileNotes = document.querySelector('#profile-notes');
const phaseSelect = document.querySelector('#phase-select');
const tempoSelect = document.querySelector('#tempo-select');
const logoutButton = document.querySelector('#logout-button');
const recommendationsNode = document.querySelector('#recommendations');
const feedTitle = document.querySelector('#feed-title');
const feedHint = document.querySelector('#feed-hint');

const state = {
  token: null,
  profile: null
};

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get('username'),
    password: formData.get('password')
  };

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }

    const data = await response.json();
    state.token = data.token;
    state.profile = data.profile;
    loginForm.reset();
    hydrateUI();
    await loadRecommendations();
  } catch (error) {
    loginError.textContent = error.message || 'Login fehlgeschlagen.';
  }
});

logoutButton?.addEventListener('click', () => {
  state.token = null;
  state.profile = null;
  hydrateUI();
});

phaseSelect?.addEventListener('change', () => {
  loadRecommendations();
});

tempoSelect?.addEventListener('change', () => {
  loadRecommendations();
});

async function hydrateUI() {
  const isLoggedIn = Boolean(state.token);
  loginPanel.classList.toggle('hidden', isLoggedIn);
  profilePanel.classList.toggle('hidden', !isLoggedIn);

  if (!isLoggedIn) {
    feedTitle.textContent = 'Melde dich an, um Empfehlungen zu sehen';
    feedHint.textContent = '';
    recommendationsNode.innerHTML = '';
    return;
  }

  profileName.textContent = state.profile?.name ?? '';
  profilePhase.textContent = state.profile?.currentPhase ?? '—';
  profilePalettes.textContent = state.profile?.favoritePalettes?.join(', ') ?? '—';
  profileNotes.textContent = state.profile?.notes ?? '';
  feedTitle.textContent = 'Dein persönlicher Metafeed';
  feedHint.textContent = 'Aktualisiere Phase oder Tempo, um den Strom umzulenken.';
}

async function loadRecommendations() {
  if (!state.token) {
    return;
  }

  setFeedStatus('Empfehlungen werden geladen …', 'Wir filtern Goodreads & StoryGraph live.');

  const params = new URLSearchParams();
  if (phaseSelect.value) {
    params.append('phase', phaseSelect.value);
  }
  if (tempoSelect.value) {
    params.append('tempo', tempoSelect.value);
  }

  try {
    const response = await fetch(`/api/recommendations?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Konnte Empfehlungen nicht laden.');
    }

    const data = await response.json();
    renderRecommendations(data.items);
    setFeedStatus('Meta-Feed aktualisiert', data.meta?.hint);
  } catch (error) {
    setFeedStatus('Ups, etwas ging schief', error.message);
  }
}

function renderRecommendations(items) {
  if (!items.length) {
    recommendationsNode.innerHTML = '<p class="hint">Keine Titel gefunden. Probier eine andere Phase.</p>';
    return;
  }

  const cards = items
    .map((item) => {
      const palette = item.colors?.map((color) => `<span class="badge">${color}</span>`).join('') ?? '';
      const vibes = item.vibes?.map((vibe) => `<span class="badge">${vibe}</span>`).join('') ?? '';
      return `
        <article class="card" style="background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));">
          <div>
            <p class="eyebrow">${item.source}</p>
            <h3 class="title">${item.title}</h3>
            <p class="author">von ${item.author}</p>
          </div>
          <p class="summary">${item.summary}</p>
          <footer>
            <span class="badge">Tempo: ${item.tempo}</span>
            <span class="badge">Score ${item.matchScore}</span>
            ${palette}
            ${vibes}
            <a href="${item.url}" target="_blank" rel="noopener noreferrer">Quelle</a>
          </footer>
        </article>
      `;
    })
    .join('');

  recommendationsNode.innerHTML = cards;
}

function setFeedStatus(title, hint) {
  feedTitle.textContent = title;
  feedHint.textContent = hint ?? '';
}
