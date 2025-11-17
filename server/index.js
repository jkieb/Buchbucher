const express = require('express');
const path = require('path');
const crypto = require('crypto');

const recommendations = require('./data/recommendations.json');
const users = require('./data/users.json');

const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function authenticate(req, res, next) {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kein Login-Token gefunden.' });
  }

  const token = header.replace('Bearer ', '');
  const username = sessions.get(token);
  if (!username) {
    return res.status(401).json({ message: 'Session ist abgelaufen. Bitte erneut einloggen.' });
  }

  const user = users.find((entry) => entry.username === username);
  if (!user) {
    return res.status(401).json({ message: 'Unbekannter Nutzer.' });
  }

  req.user = user;
  req.token = token;
  next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Bitte Benutzername und Passwort angeben.' });
  }

  const user = users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    return res.status(401).json({ message: 'Kombination unbekannt. Nutze z.B. mira/atlas oder leo/delta.' });
  }

  const existingToken = [...sessions.entries()].find(([, name]) => name === user.username)?.[0];
  if (existingToken) {
    sessions.delete(existingToken);
  }

  const token = createToken();
  sessions.set(token, user.username);

  const { password: _, ...publicProfile } = user;

  res.json({
    token,
    profile: {
      ...publicProfile,
      onboarding: 'Diese App tanzt über Goodreads und StoryGraph und filtert, was zu deiner aktuellen Phase passt.'
    }
  });
});

app.get('/api/profile', authenticate, (req, res) => {
  const { password: _password, ...publicProfile } = req.user;
  res.json({
    profile: publicProfile,
    rituals: [
      'Passe deine Phase an, sobald sich dein Fokus verschiebt.',
      'Markiere mental, welche Farben oder Texturen dich gerade anziehen.'
    ]
  });
});

app.get('/api/recommendations', authenticate, (req, res) => {
  const { phase, tempo } = req.query;

  const filtered = recommendations
    .map((entry) => {
      const phaseScore = phase && entry.phases.includes(phase) ? 1 : 0;
      const tempoScore = tempo && entry.tempo === tempo ? 1 : 0;
      const userPhaseScore = entry.phases.includes(req.user.currentPhase) ? 1 : 0;
      return {
        ...entry,
        matchScore: phaseScore + tempoScore + userPhaseScore
      };
    })
    .filter((entry) => {
      const phaseMatch = phase ? entry.phases.includes(phase) : true;
      const tempoMatch = tempo ? entry.tempo === tempo : true;
      return phaseMatch && tempoMatch;
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const response = filtered.map((entry) => ({
    title: entry.title,
    author: entry.author,
    summary: entry.summary,
    source: entry.source,
    url: entry.url,
    colors: entry.colors,
    vibes: entry.vibes,
    tempo: entry.tempo,
    matchScore: entry.matchScore
  }));

  res.json({
    items: response,
    meta: {
      phase: phase || req.user.currentPhase,
      tempo: tempo || 'flexibel',
      hint: 'Datenbasis: Goodreads & StoryGraph. Wir kuratieren nur die Schnittmenge, die zu deinem jetzigen Fokus passt.'
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Buchbucher lauscht auf Port ${PORT}`);
});
