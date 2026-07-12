const BUILD_VERSION = '5';
console.log(`Beat Parry build ${BUILD_VERSION}`);

const canvas = document.getElementById('game-canvas');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const results = document.getElementById('results');
const songList = document.getElementById('song-list');
const trainingList = document.getElementById('training-list');
const dodgeList = document.getElementById('dodge-list');
const flashOverlay = document.getElementById('flash-overlay');
const trainingBadge = document.getElementById('training-badge');
const dodgeBadge = document.getElementById('dodge-badge');
const trainingLevelHud = document.getElementById('training-level-hud');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const songNameEl = document.getElementById('song-name');
const progressFill = document.getElementById('progress-fill');
const rudBalanceEl = document.getElementById('rud-balance');
const rudWalletEl = document.getElementById('rud-wallet');
const userNameBtn = document.getElementById('user-name-btn');
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const usernameInput = document.getElementById('username-input');
const userFormError = document.getElementById('user-form-error');

const game = new BeatParryGame(canvas);
let lastTrainingSong = null;
let lastDodgeSong = null;

function updateRudDisplay(animate) {
  rudBalanceEl.textContent = RUDWallet.balance.toLocaleString();
  userNameBtn.textContent = RUDWallet.username || 'Player';
  if (animate) {
    rudWalletEl.classList.add('pulse');
    setTimeout(() => rudWalletEl.classList.remove('pulse'), 500);
  }
}

function showUserModal(message) {
  userModal.classList.remove('hidden');
  userFormError.classList.add('hidden');
  userFormError.textContent = '';
  if (message) {
    userFormError.textContent = message;
    userFormError.classList.remove('hidden');
  }
  usernameInput.value = RUDWallet.getStoredUsername();
  usernameInput.focus();
}

function hideUserModal() {
  userModal.classList.add('hidden');
}

async function handleUserSubmit(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();
  userFormError.classList.add('hidden');

  try {
    await RUDWallet.register(username);
    hideUserModal();
    updateRudDisplay(false);
  } catch (err) {
    userFormError.textContent = err.message;
    userFormError.classList.remove('hidden');
  }
}

async function initApp() {
  try {
    const { needsUsername } = await RUDWallet.init();
    updateRudDisplay(false);
    if (needsUsername) showUserModal();
  } catch (err) {
    showUserModal('Could not connect to server. Start with: npm start');
    userFormError.textContent = err.message;
    userFormError.classList.remove('hidden');
  }

  await audioEngine.resume();
  updateSoundMenuSelection();
}

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
      card.addEventListener('click', () => startSong(song, false));
      cards.appendChild(card);
    }

    section.appendChild(cards);
    songList.appendChild(section);
  }
}

function buildTrainingList() {
  trainingList.innerHTML = '';

  const modes = [
    { layers: 1, mode: TRAINING_MODES.oneLayer },
    { layers: 2, mode: TRAINING_MODES.twoLayer },
  ];

  for (const { layers, mode } of modes) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'training-mode-card';
    card.innerHTML = `
      <div class="training-mode-icon" style="background: ${DIFFICULTY_META[mode.difficulty].ballColor}"></div>
      <div class="training-mode-info">
        <div class="name">${mode.name}</div>
        <div class="meta">${mode.description}</div>
        <div class="meta">Keys: ${layers === 1 ? 'F · J' : 'F · G · J · K'}</div>
      </div>
      <span class="training-tag">Endless</span>
    `;
    card.addEventListener('click', () => startSong(createEndlessTraining(layers), true));
    trainingList.appendChild(card);
  }
}

function buildDodgeList() {
  dodgeList.innerHTML = '';
  const mode = createDodgeMode();

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'training-mode-card dodge-mode-card';
  card.innerHTML = `
    <div class="training-mode-icon" style="background: ${mode.color}"></div>
    <div class="training-mode-info">
      <div class="name">${mode.name}</div>
      <div class="meta">${mode.description}</div>
      <div class="meta">White warning lines · cursor dodge · endless</div>
    </div>
    <span class="training-tag" style="background: rgba(255,107,107,0.2); color: #ff8888">Endless</span>
  `;
  card.addEventListener('click', () => startDodgeMode(mode));
  dodgeList.appendChild(card);
}

function setupMenuTabs() {
  const tabs = {
    play: {
      tab: document.getElementById('tab-play'),
      panel: document.getElementById('play-panel'),
    },
    training: {
      tab: document.getElementById('tab-training'),
      panel: document.getElementById('training-panel'),
    },
    dodge: {
      tab: document.getElementById('tab-dodge'),
      panel: document.getElementById('dodge-panel'),
    },
    sounds: {
      tab: document.getElementById('tab-sounds'),
      panel: document.getElementById('sounds-panel'),
    },
  };

  function showPanel(name) {
    for (const [key, { tab, panel }] of Object.entries(tabs)) {
      tab.classList.toggle('active', key === name);
      panel.classList.toggle('hidden', key !== name);
    }
  }

  tabs.play.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('play');
  });

  tabs.training.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('training');
  });

  tabs.dodge.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('dodge');
  });

  tabs.sounds.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('sounds');
    updateSoundMenuSelection();
  });
}

function buildSoundList() {
  const soundList = document.getElementById('sound-list');
  soundList.innerHTML = '';

  const keycapProfiles = [
    { id: 'creamy', swatch: '#f5e6c8' },
    { id: 'blue', swatch: '#4d9fff' },
    { id: 'red', swatch: '#ff4d4d' },
  ];

  for (const { id, swatch } of keycapProfiles) {
    const profile = PARRY_SOUND_PROFILES[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sound-option-card';
    card.dataset.profile = id;
    card.innerHTML = `
      <div class="sound-option-icon" style="background: ${swatch}"></div>
      <div class="sound-option-info">
        <div class="name">${profile.label}</div>
        <div class="meta">${profile.description}</div>
      </div>
      <span class="sound-active-tag hidden">Active</span>
    `;
    card.addEventListener('click', () => selectSoundProfile(id));
    soundList.appendChild(card);
  }
}

function updateSoundMenuSelection() {
  const active = audioEngine.getParryProfile();
  document.querySelectorAll('.sound-option-card').forEach((card) => {
    const isActive = card.dataset.profile === active;
    card.classList.toggle('selected', isActive);
    card.querySelector('.sound-active-tag').classList.toggle('hidden', !isActive);
  });
  document.getElementById('sound-reset-btn').disabled = active === 'default';
}

async function selectSoundProfile(profileId) {
  await audioEngine.resume();
  await audioEngine.setParryProfile(profileId);
  updateSoundMenuSelection();
  audioEngine.previewParrySound();
}

async function resetSoundProfile() {
  await audioEngine.resume();
  await audioEngine.resetParryProfile();
  updateSoundMenuSelection();
  audioEngine.previewParrySound();
}

function showMenu() {
  menu.classList.remove('hidden');
  menu.classList.add('active');
  canvas.classList.remove('playing');
}

function hideMenu() {
  menu.classList.remove('active');
  menu.classList.add('hidden');
  canvas.classList.add('playing');
}

async function startSong(song, isTraining) {
  await audioEngine.resume();

  if (isTraining) lastTrainingSong = song;

  hideMenu();
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');
  trainingBadge.classList.toggle('hidden', !isTraining);
  dodgeBadge.classList.add('hidden');
  trainingLevelHud.classList.toggle('hidden', !isTraining);

  songNameEl.textContent = song.name;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');

  game.onScoreUpdate = ({ score, combo, rating, side, lane }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    if (!isTraining) {
      scoreEl.parentElement.classList.toggle('penalty', rating === 'bad' || rating === 'miss');
    }
    if (isTraining && song.endless) {
      trainingLevelHud.textContent = `Level ${game.getTrainingLevel()}`;
      progressFill.style.width = `${game.getProgress() * 100}%`;
    } else {
      progressFill.style.width = `${game.getProgress() * 100}%`;
    }

    if (rating) {
      flashOverlay.className = rating;
      flashOverlay.style.opacity = '1';
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);
      showParryPopup(rating, isTraining, side, lane);
    }
  };

  game.onComplete = (data) => showResults(data, isTraining);
  game.onTrainingExit = () => finishTraining();
  game.onTrainingRestart = () => startSong(song, true);
  game.start(song, { training: isTraining, dodge: false });

  const progressInterval = setInterval(() => {
    if (game.state !== 'playing') {
      clearInterval(progressInterval);
      return;
    }
    if (isTraining && song.endless) {
      trainingLevelHud.textContent = `Level ${game.getTrainingLevel()}`;
    }
    progressFill.style.width = `${game.getProgress() * 100}%`;
  }, 100);
}

async function startDodgeMode(song) {
  await audioEngine.resume();
  lastDodgeSong = song;

  hideMenu();
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');
  trainingBadge.classList.add('hidden');
  dodgeBadge.classList.remove('hidden');
  trainingLevelHud.classList.remove('hidden');

  songNameEl.textContent = song.name;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');

  game.onScoreUpdate = ({ score, combo, rating }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    trainingLevelHud.textContent = `Level ${game.getTrainingLevel()}`;
    progressFill.style.width = `${game.getProgress() * 100}%`;

    if (rating === 'miss') {
      flashOverlay.className = rating;
      flashOverlay.style.opacity = '1';
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);
      showDodgeHitPopup();
    }
  };

  game.onComplete = (data) => showResults(data, true);
  game.onTrainingExit = () => finishDodge();
  game.onTrainingRestart = () => startDodgeMode(song);
  game.start(song, { training: false, dodge: true });

  const progressInterval = setInterval(() => {
    if (game.state !== 'playing') {
      clearInterval(progressInterval);
      return;
    }
    trainingLevelHud.textContent = `Level ${game.getTrainingLevel()}`;
    progressFill.style.width = `${game.getProgress() * 100}%`;
  }, 100);
}

function finishDodge() {
  const data = game.getTrainingSummary();
  game.stop();
  showResults(data, true);
}

function showDodgeHitPopup() {
  const popup = document.createElement('div');
  popup.className = 'parry-popup miss';
  popup.textContent = 'HIT!';
  popup.style.left = `${game.playerX}px`;
  popup.style.top = `${game.playerY - 30}px`;
  document.getElementById('app').appendChild(popup);
  setTimeout(() => popup.remove(), 600);
}

function finishTraining() {
  const data = game.getTrainingSummary();
  game.stop();
  showResults(data, true);
}

function showParryPopup(rating, isTraining, side, lane) {
  const labels = isTraining
    ? {
        excellent: 'EXCELLENT!',
        good: 'GOOD',
        medium: 'OK',
        bad: 'TOO EARLY/LATE',
        miss: 'MISSED',
      }
    : {
        excellent: 'EXCELLENT!',
        good: 'GOOD',
        medium: 'MEDIUM',
        bad: 'BAD −150',
        miss: 'MISS −50',
      };

  const popup = document.createElement('div');
  popup.className = `parry-popup ${rating}`;
  popup.textContent = labels[rating] || rating.toUpperCase();

  const layers = game.song ? getSongLayers(game.song) : 2;
  const laneY = layers === 1 ? 0 : (lane === 0 ? -28 : 28);
  const sideX = side === 'left' ? -120 : 120;
  popup.style.left = `${window.innerWidth / 2 + (side ? sideX : 0)}px`;
  popup.style.top = `${window.innerHeight / 2 + (lane != null ? laneY : 0)}px`;

  document.getElementById('app').appendChild(popup);
  setTimeout(() => popup.remove(), 600);
}

async function showResults(data, isTraining) {
  hud.classList.add('hidden');
  trainingBadge.classList.add('hidden');
  dodgeBadge.classList.add('hidden');
  trainingLevelHud.classList.add('hidden');

  const titleEl = document.getElementById('results-title');
  const gradeEl = document.getElementById('grade');
  const retryBtn = document.getElementById('retry-btn');
  const summaryLine = document.getElementById('training-summary-line');
  const levelWrap = document.getElementById('stat-level-wrap');
  const timeWrap = document.getElementById('stat-time-wrap');

  titleEl.textContent = isTraining
    ? (data.dodge ? 'Dodge Complete' : 'Training Complete')
    : 'Song Complete';
  gradeEl.style.display = isTraining ? 'none' : 'block';
  summaryLine.classList.toggle('hidden', !isTraining);
  levelWrap.classList.toggle('hidden', !isTraining);
  timeWrap.classList.toggle('hidden', !isTraining);

  if (isTraining) {
    summaryLine.textContent = data.dodge
      ? `You reached Level ${data.trainingLevel} — ${data.stats.excellent} dodged, ${data.stats.miss} hit`
      : `You reached Level ${data.trainingLevel} in ${data.timeSurvived}s`;
    document.getElementById('stat-level').textContent = data.trainingLevel;
    document.getElementById('stat-time').textContent = `${data.timeSurvived}s`;
  }

  document.getElementById('final-score').textContent = data.score.toLocaleString();
  document.getElementById('final-accuracy').textContent = `${data.accuracy}%`;
  document.getElementById('stat-excellent').textContent = data.stats.excellent;
  document.getElementById('stat-good').textContent = data.stats.good;
  document.getElementById('stat-medium').textContent = data.stats.medium;
  document.getElementById('stat-bad').textContent = data.stats.bad;
  document.getElementById('stat-miss').textContent = data.stats.miss;
  document.getElementById('stat-max-combo').textContent = data.maxCombo;

  if (!isTraining) {
    gradeEl.textContent = data.grade;
    gradeEl.className = `grade ${data.grade}`;
  }

  const songId = data.songId || game.song?.id;
  const rudEarnedEl = document.getElementById('rud-earned');
  const isDodge = !!data.dodge;

  try {
    const reward = await RUDWallet.completeGame({
      score: data.score,
      grade: data.grade,
      songId,
      isTraining: isTraining && !isDodge,
      isDodge,
      trainingLevel: data.trainingLevel,
      dodged: data.stats?.excellent || 0,
    });

    if (reward.earned > 0) {
      updateRudDisplay(true);

      let earnedText = `+${reward.earned.toLocaleString()} RUD earned`;
      if (reward.isNewBest && reward.bonus > 0) {
        earnedText += `<span class="rud-bonus">New best! +${reward.bonus.toLocaleString()} bonus</span>`;
      } else if (reward.isNewBest) {
        earnedText += `<span class="rud-bonus">New personal best!</span>`;
      }
      rudEarnedEl.innerHTML = earnedText;
      rudEarnedEl.classList.remove('hidden');
    } else {
      rudEarnedEl.classList.add('hidden');
      rudEarnedEl.textContent = '';
    }
  } catch {
    const preview = RUDWallet.previewReward({
      score: data.score,
      grade: data.grade,
      isTraining: isTraining && !isDodge,
      isDodge,
      trainingLevel: data.trainingLevel,
      songId,
      dodged: data.stats?.excellent || 0,
    });
    if (preview.earned > 0) {
      rudEarnedEl.innerHTML = `+${preview.earned.toLocaleString()} RUD (offline — not saved)`;
      rudEarnedEl.classList.remove('hidden');
    } else {
      rudEarnedEl.classList.add('hidden');
    }
  }

  retryBtn.classList.toggle('hidden', !isTraining);
  retryBtn.onclick = () => {
    if (data.dodge && lastDodgeSong) startDodgeMode(lastDodgeSong);
    else if (lastTrainingSong) startSong(lastTrainingSong, true);
  };

  results.classList.remove('hidden');
  results.classList.add('active');
}

document.getElementById('back-btn').addEventListener('click', () => {
  game.stop();
  results.classList.remove('active');
  results.classList.add('hidden');
  trainingBadge.classList.add('hidden');
  dodgeBadge.classList.add('hidden');
  trainingLevelHud.classList.add('hidden');
  showMenu();
});

buildSongList();
buildTrainingList();
buildDodgeList();
buildSoundList();
setupMenuTabs();
document.getElementById('sound-reset-btn').addEventListener('click', resetSoundProfile);
userForm.addEventListener('submit', handleUserSubmit);
userNameBtn.addEventListener('click', () => showUserModal());
initApp();
