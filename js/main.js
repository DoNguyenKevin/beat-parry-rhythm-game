const canvas = document.getElementById('game-canvas');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const results = document.getElementById('results');
const songList = document.getElementById('song-list');
const flashOverlay = document.getElementById('flash-overlay');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const songNameEl = document.getElementById('song-name');
const progressFill = document.getElementById('progress-fill');

const game = new BeatParryGame(canvas);

function buildSongList() {
  songList.innerHTML = '';
  const grouped = getSongsByLevel();

  for (const level of DIFFICULTY_ORDER) {
    const songs = grouped[level];
    if (!songs.length) continue;

    const meta = DIFFICULTY_META[level];
    const section = document.createElement('div');
    section.className = 'level-section';

    const header = document.createElement('div');
    header.className = 'level-header';
    header.innerHTML = `
      <span class="level-dot" style="background: ${meta.ballColor}"></span>
      <span class="level-name">${meta.label}</span>
      <span class="level-meta">${meta.layers} layer${meta.layers > 1 ? 's' : ''} · ${songs.length} song${songs.length > 1 ? 's' : ''}</span>
    `;
    section.appendChild(header);

    const cards = document.createElement('div');
    cards.className = 'level-songs';

    for (const song of songs) {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.innerHTML = `
        <div>
          <div class="name">${song.name}</div>
          <div class="meta">${song.bpm} BPM · ${song.duration}s</div>
        </div>
        <span class="difficulty ${song.difficulty}">${meta.label}</span>
      `;
      card.addEventListener('click', () => startSong(song));
      cards.appendChild(card);
    }

    section.appendChild(cards);
    songList.appendChild(section);
  }
}

async function startSong(song) {
  await audioEngine.resume();

  menu.classList.remove('active');
  menu.classList.add('hidden');
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');

  songNameEl.textContent = song.name;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';

  game.onScoreUpdate = ({ score, combo, rating, side, lane }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    scoreEl.parentElement.classList.toggle('penalty', rating === 'bad' || rating === 'miss');
    progressFill.style.width = `${game.getProgress() * 100}%`;

    flashOverlay.className = rating;
    flashOverlay.style.opacity = '1';
    setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);

    showParryPopup(rating, side, lane);
  };

  game.onComplete = (data) => showResults(data);
  game.start(song);

  const progressInterval = setInterval(() => {
    if (game.state !== 'playing') {
      clearInterval(progressInterval);
      return;
    }
    progressFill.style.width = `${game.getProgress() * 100}%`;
  }, 100);
}

function showParryPopup(rating, side, lane) {
  const labels = {
    excellent: 'EXCELLENT!',
    good: 'GOOD',
    medium: 'MEDIUM',
    bad: 'BAD −150',
    miss: 'MISS −50',
  };

  const popup = document.createElement('div');
  popup.className = `parry-popup ${rating}`;
  popup.textContent = labels[rating];

  const layers = game.song ? getSongLayers(game.song) : 2;
  const laneY = layers === 1 ? 0 : (lane === 0 ? -28 : 28);
  const sideX = side === 'left' ? -120 : 120;
  popup.style.left = `${window.innerWidth / 2 + sideX}px`;
  popup.style.top = `${window.innerHeight / 2 + laneY}px`;

  document.getElementById('app').appendChild(popup);
  setTimeout(() => popup.remove(), 600);
}

function showResults(data) {
  hud.classList.add('hidden');

  document.getElementById('final-score').textContent = data.score.toLocaleString();
  document.getElementById('final-accuracy').textContent = `${data.accuracy}%`;
  document.getElementById('stat-excellent').textContent = data.stats.excellent;
  document.getElementById('stat-good').textContent = data.stats.good;
  document.getElementById('stat-medium').textContent = data.stats.medium;
  document.getElementById('stat-bad').textContent = data.stats.bad;
  document.getElementById('stat-miss').textContent = data.stats.miss;
  document.getElementById('stat-max-combo').textContent = data.maxCombo;

  const gradeEl = document.getElementById('grade');
  gradeEl.textContent = data.grade;
  gradeEl.className = `grade ${data.grade}`;

  results.classList.remove('hidden');
  results.classList.add('active');
}

document.getElementById('back-btn').addEventListener('click', () => {
  game.stop();
  results.classList.remove('active');
  results.classList.add('hidden');
  menu.classList.remove('hidden');
  menu.classList.add('active');
});

buildSongList();

function idleLoop() {
  if (game.state === 'idle') {
    game.song = SONGS[0];
    game.draw();
  }
  requestAnimationFrame(idleLoop);
}
idleLoop();
