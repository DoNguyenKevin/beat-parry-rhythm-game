const BUILD_VERSION = '12';
console.log(`Beat Parry build ${BUILD_VERSION}`);

const canvas = document.getElementById('game-canvas');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const results = document.getElementById('results');
const songList = document.getElementById('song-list');
const trainingList = document.getElementById('training-list');
const dodgeList = document.getElementById('dodge-list');
const bossList = document.getElementById('boss-list');
const flashOverlay = document.getElementById('flash-overlay');
const trainingBadge = document.getElementById('training-badge');
const nightmareBadge = document.getElementById('nightmare-badge');
const dodgeBadge = document.getElementById('dodge-badge');
const bossBadge = document.getElementById('boss-badge');
const trainingLevelHud = document.getElementById('training-level-hud');
const dodgeHealthHud = document.getElementById('dodge-health-hud');
const dodgeHealthFill = document.getElementById('dodge-health-fill');
const dodgeHealthText = document.getElementById('dodge-health-text');

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
const passwordInput = document.getElementById('password-input');
const userFormError = document.getElementById('user-form-error');
const authTabLogin = document.getElementById('auth-tab-login');
const authTabRegister = document.getElementById('auth-tab-register');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authChangeAccountBtn = document.getElementById('auth-change-account-btn');
const changeAccountBtn = document.getElementById('change-account-btn');
const authModalTitle = document.getElementById('auth-modal-title');

let authMode = 'login';
const loadoutBar = document.getElementById('loadout-bar');
const skinBar = document.getElementById('skin-bar');
const abilityHud = document.getElementById('ability-hud');

const game = new BeatParryGame(canvas);
let lastTrainingSong = null;
let lastDodgeSong = null;
let lastBossSong = null;
let lastNightmareSong = null;

function updateRudDisplay(animate) {
  rudBalanceEl.textContent = RUDWallet.balance.toLocaleString();
  userNameBtn.textContent = RUDWallet.username || 'Player';
  const loggedIn = RUDWallet.ready && RUDWallet.userId;
  changeAccountBtn.classList.toggle('hidden', !loggedIn);
  if (animate) {
    rudWalletEl.classList.add('pulse');
    setTimeout(() => rudWalletEl.classList.remove('pulse'), 500);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  authTabLogin.classList.toggle('active', isLogin);
  authTabRegister.classList.toggle('active', !isLogin);
  authSubmitBtn.textContent = isLogin ? 'Log in' : 'Create account';
  authModalTitle.textContent = isLogin ? 'Log in' : 'Create account';
  passwordInput.placeholder = isLogin ? 'Password' : 'Password (4+ characters)';
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  userFormError.classList.add('hidden');
}

function showUserModal(message) {
  userModal.classList.remove('hidden');
  userFormError.classList.add('hidden');
  userFormError.textContent = '';
  if (message) {
    userFormError.textContent = message;
    userFormError.classList.remove('hidden');
  }

  const loggedIn = RUDWallet.ready && RUDWallet.userId;
  userForm.classList.toggle('hidden', loggedIn);
  authChangeAccountBtn.classList.toggle('hidden', !loggedIn);
  authTabLogin.parentElement.classList.toggle('hidden', loggedIn);
  document.querySelector('.auth-modal-desc').classList.toggle('hidden', loggedIn);
  authModalTitle.textContent = loggedIn ? `Signed in as ${RUDWallet.username}` : (authMode === 'login' ? 'Log in' : 'Create account');

  if (!loggedIn) {
    usernameInput.value = RUDWallet.getStoredUsername();
    passwordInput.value = '';
    setAuthMode(authMode);
    usernameInput.focus();
  }
}

function hideUserModal() {
  userModal.classList.add('hidden');
}

async function handleUserSubmit(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  userFormError.classList.add('hidden');

  try {
    if (authMode === 'register') {
      await RUDWallet.register(username, password);
    } else {
      await RUDWallet.login(username, password);
    }
    hideUserModal();
    updateRudDisplay(false);
    refreshShopUI();
  } catch (err) {
    userFormError.textContent = err.message;
    userFormError.classList.remove('hidden');
  }
}

async function handleChangeAccount() {
  await RUDWallet.logout();
  updateRudDisplay(false);
  refreshShopUI();
  setAuthMode('login');
  showUserModal('Sign in with a different account.');
}

async function initApp() {
  try {
    const { needsAuth } = await RUDWallet.init();
    if (needsAuth && typeof Shop !== 'undefined') {
      Shop.setSecretUnlocks([]);
    }
    updateRudDisplay(false);
    refreshShopUI();
    if (needsAuth) {
      setAuthMode('login');
      showUserModal();
    }
  } catch (err) {
    setAuthMode('login');
    showUserModal('Could not connect to server. Start with: npm start');
    userFormError.textContent = err.message;
    userFormError.classList.remove('hidden');
  }

  await audioEngine.resume();
  updateSoundMenuSelection();
  renderLoadoutBar();
  renderSkinBar();
}

function modeLabel(mode) {
  return { play: 'Play', training: 'Training', dodge: 'Dodge', boss: 'Boss' }[mode] || mode;
}

function renderLoadoutBar() {
  const equipped = Shop.equipped.filter((id) => Shop.getQuantity(id) > 0);
  if (!equipped.length) {
    loadoutBar.innerHTML = '<span class="loadout-empty">No abilities equipped — visit Shop</span>';
    return;
  }
  loadoutBar.innerHTML = equipped.map((id) => {
    const item = Shop.getItem(id);
    const modes = item.modes.map(modeLabel).join(' · ');
    return `<span class="loadout-chip" title="${modes}">${item.icon} ${item.name} ×${Shop.getQuantity(id)}</span>`;
  }).join('');
}

function buildShopList() {
  const shopList = document.getElementById('shop-list');
  shopList.innerHTML = '';

  for (const item of Shop.getItems()) {
    if (item.secret && !Shop.isSecretUnlocked(item.id)) continue;

    const card = document.createElement('div');
    card.className = 'shop-item-card';
    if (item.secret) card.classList.add('shop-item-secret');
    card.dataset.ability = item.id;
    const qty = Shop.getQuantity(item.id);
    const equipped = Shop.isEquipped(item.id);
    const canEquip = Shop.canEquip(item.id);
    const modes = item.modes.map(modeLabel).join(', ');
    const priceLabel = item.secret ? 'Secret unlock' : `${item.price.toLocaleString()} RUD`;

    card.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="name">${item.name}</div>
        <div class="meta">${item.description}</div>
        <div class="meta shop-modes">For: ${modes}</div>
        <div class="shop-item-footer">
          <span class="shop-price">${priceLabel}</span>
          <span class="shop-owned">Owned: <strong>${qty}</strong></span>
        </div>
      </div>
      <div class="shop-item-actions">
        ${item.secret ? '' : '<button type="button" class="btn btn-small shop-buy-btn">Buy</button>'}
        <button type="button" class="btn btn-secondary btn-small shop-equip-btn" ${canEquip ? '' : 'disabled'}>${equipped ? 'Equipped' : 'Equip'}</button>
      </div>
    `;

    const buyBtn = card.querySelector('.shop-buy-btn');
    if (buyBtn) buyBtn.addEventListener('click', () => buyAbility(item.id));
    card.querySelector('.shop-equip-btn').addEventListener('click', () => toggleEquipAbility(item.id));
    shopList.appendChild(card);
  }
}

function renderSkinBar() {
  if (!skinBar) return;
  const skin = Skins.getEquippedData();
  const passiveText = formatSkinPassives(skin.passives);
  skinBar.innerHTML = `<span class="skin-bar-chip" style="--skin-color: ${skin.colors?.primary || '#ff6b9d'}">${skin.icon} ${skin.name} · ${passiveText}</span>`;
}

function buildSkinsList() {
  const skinsList = document.getElementById('skins-list');
  if (!skinsList) return;
  skinsList.innerHTML = '';

  for (const skin of Skins.getList()) {
    if (skin.secret && !Skins.owns(skin.id)) continue;

    const owned = Skins.owns(skin.id);
    const equipped = Skins.isEquipped(skin.id);
    const priceLabel = skin.secret ? 'Secret unlock' : skin.price === 0 ? 'Free' : `${skin.price.toLocaleString()} RUD`;
    const passiveText = formatSkinPassives(skin.passives);

    const card = document.createElement('div');
    card.className = 'shop-item-card skin-item-card';
    if (skin.secret) card.classList.add('shop-item-secret');
    card.dataset.skin = skin.id;
    const previewStyle = skin.effect === 'cosmic'
      ? 'background: radial-gradient(circle at 30% 28%, #e8f4ff, #7b2cbf 35%, #3a0ca3 58%, #10002b 78%, #030109); box-shadow: 0 0 22px rgba(224, 64, 251, 0.55);'
      : `background: radial-gradient(circle at 35% 35%, ${skin.colors?.accent || '#fff'}, ${skin.colors?.primary || '#ff6b9d'} 55%, ${skin.colors?.glow || '#ff6b9d'})`;
    card.innerHTML = `
      <div class="shop-item-icon skin-preview" style="${previewStyle}">${skin.icon}</div>
      <div class="shop-item-info">
        <div class="name">${skin.name}</div>
        <div class="meta">${skin.description}</div>
        <div class="meta shop-modes">Passive: ${passiveText}</div>
        <div class="shop-item-footer">
          <span class="shop-price">${priceLabel}</span>
          <span class="shop-owned">${owned ? 'Owned' : 'Not owned'}</span>
        </div>
      </div>
      <div class="shop-item-actions">
        ${owned || skin.secret ? '' : '<button type="button" class="btn btn-small skin-buy-btn">Buy</button>'}
        <button type="button" class="btn btn-secondary btn-small skin-equip-btn" ${owned ? '' : 'disabled'}>${equipped ? 'Equipped' : 'Equip'}</button>
      </div>
    `;

    const buyBtn = card.querySelector('.skin-buy-btn');
    if (buyBtn) buyBtn.addEventListener('click', () => buySkin(skin.id));
    card.querySelector('.skin-equip-btn').addEventListener('click', () => equipSkin(skin.id));
    skinsList.appendChild(card);
  }
}

function refreshSkinsUI() {
  buildSkinsList();
  renderSkinBar();
}

async function buySkin(skinId) {
  try {
    await Skins.buy(skinId);
    updateRudDisplay(false);
    refreshSkinsUI();
  } catch (err) {
    alert(err.message);
  }
}

async function equipSkin(skinId) {
  try {
    await Skins.equip(skinId);
    refreshSkinsUI();
  } catch (err) {
    alert(err.message);
  }
}

function refreshShopUI() {
  const redeemSection = document.querySelector('.shop-redeem');
  if (redeemSection) {
    redeemSection.classList.toggle('hidden', !RUDWallet.canRedeemSecrets);
  }
  buildShopList();
  renderLoadoutBar();
  refreshSkinsUI();
}

async function buyAbility(abilityId) {
  try {
    await Shop.buy(abilityId);
    updateRudDisplay(false);
    refreshShopUI();
  } catch (err) {
    alert(err.message);
  }
}

function toggleEquipAbility(abilityId) {
  if (Shop.isEquipped(abilityId)) {
    Shop.equipped = Shop.equipped.filter((id) => id !== abilityId);
    Shop.saveLoadout();
  } else {
    if (!Shop.toggleEquip(abilityId)) {
      const item = Shop.getItem(abilityId);
      if (item?.secret) {
        alert('Unlock this secret ability first.');
      } else {
        alert(`Equip up to ${MAX_EQUIPPED} shop abilities. Secret skills (Overdrive, Void Dash) are extra.`);
      }
      return;
    }
  }
  refreshShopUI();
}

function abilityKeyHint(id) {
  if (id === 'op-overdrive') return ' · SPACE';
  if (id === 'op-void-dash') return ' · V';
  return '';
}

function updateDodgeHealthHud(health, maxHealth) {
  const max = maxHealth || DODGE_MAX_HEALTH;
  const current = Math.max(0, Math.min(max, health ?? max));
  const pct = (current / max) * 100;
  dodgeHealthFill.style.width = `${pct}%`;
  dodgeHealthText.textContent = String(Math.ceil(current));
  dodgeHealthFill.classList.toggle('low', pct <= 25);
  dodgeHealthFill.classList.toggle('mid', pct > 25 && pct <= 50);
}

function showAbilityHud(abilities) {
  const display = typeof expandRunAbilities === 'function'
    ? expandRunAbilities(abilities || [])
    : (abilities || []);
  if (!display.length) {
    abilityHud.classList.add('hidden');
    abilityHud.innerHTML = '';
    return;
  }
  abilityHud.innerHTML = display.map((id) => {
    const item = Shop.getItem(id);
    const hint = abilityKeyHint(id);
    const cosmic = Skins.getEquipped() === 'skin-void-god'
      && (id === 'op-overdrive' || id === 'op-void-dash');
    const cls = cosmic ? 'ability-chip ability-chip-cosmic' : 'ability-chip';
    return `<span class="${cls}">${item?.icon || '✦'} ${item?.name || id}${hint}${cosmic ? ' ✦' : ''}</span>`;
  }).join('');
  abilityHud.classList.remove('hidden');
}

function setRedeemMessage(text, isError = false) {
  const el = document.getElementById('shop-redeem-msg');
  if (!el) return;
  if (!text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
}

async function redeemShopCode() {
  const input = document.getElementById('shop-code-input');
  const code = input?.value?.trim();
  if (!code) {
    setRedeemMessage('Enter a code first.', true);
    return;
  }
  try {
    const unlocked = await Shop.redeemCode(code);
    const ids = Array.isArray(unlocked) ? unlocked : [unlocked];
    const names = ids.map((id) => Shop.getItem(id)?.name || Skins.getSkin(id)?.name || id).join(' + ');
    setRedeemMessage(`Unlocked: ${names}! Equip them below.`, false);
    if (input) input.value = '';
    refreshShopUI();
    refreshSkinsUI();
  } catch (err) {
    if (err.message.includes('Code already redeemed')) {
      if (RUDWallet.userId) {
        try {
          const profile = await RUDWallet.api(`/api/users/${RUDWallet.userId}`);
          RUDWallet.applyProfile(profile);
          refreshShopUI();
          refreshSkinsUI();
          if (Skins.owns('skin-void-god')) {
            setRedeemMessage('Void God skin unlocked! Check the Skins tab.', false);
            if (input) input.value = '';
            return;
          }
        } catch {
          // fall through
        }
      }
      setRedeemMessage('That secret is already unlocked. Equip it below.', false);
      refreshShopUI();
      refreshSkinsUI();
      return;
    }
    setRedeemMessage(err.message, true);
  }
}

async function prepareRunAbilities(mode) {
  try {
    const data = await Shop.consumeForRun(mode);
    refreshShopUI();
    return expandRunAbilities(data.abilities || []);
  } catch (err) {
    console.warn('[Shop] consume failed:', err.message);
    return expandRunAbilities(Shop.getEquippedForMode(mode));
  }
}

function buildNightmareList() {
  const list = document.getElementById('nightmare-list');
  if (!list) return;
  list.innerHTML = '';

  const meta = DIFFICULTY_META.nightmare;
  const section = document.createElement('div');
  section.className = 'level-section';

  const header = document.createElement('div');
  header.className = 'level-header';
  header.innerHTML = `
    <span class="level-dot" style="background: ${meta.ballColor}"></span>
    <span class="level-name">${meta.label}</span>
    <span class="level-meta">${meta.layers} layers · ${NIGHTMARE_SONGS.length} songs · S = ${NIGHTMARE_S_RUD.toLocaleString()} RUD</span>
  `;
  section.appendChild(header);

  const cards = document.createElement('div');
  cards.className = 'level-songs';

  for (const song of NIGHTMARE_SONGS) {
    const card = document.createElement('div');
    card.className = 'song-card nightmare-card';
    card.innerHTML = `
      <div>
        <div class="name">${song.name}</div>
        <div class="meta">${song.bpm} BPM · ${song.duration}s · ultra dense</div>
      </div>
      <span class="difficulty nightmare">${meta.label}</span>
    `;
    card.addEventListener('click', () => startSong(song, false, { nightmare: true }));
    cards.appendChild(card);
  }

  section.appendChild(cards);
  list.appendChild(section);
}

function setupPlaySubtabs() {
  const standardTab = document.getElementById('play-tab-standard');
  const nightmareTab = document.getElementById('play-tab-nightmare');
  const songListEl = document.getElementById('song-list');
  const nightmareListEl = document.getElementById('nightmare-list');
  const nightmareIntro = document.getElementById('nightmare-intro');
  if (!standardTab || !nightmareTab) return;

  function showPlaySubtab(name) {
    const isNightmare = name === 'nightmare';
    standardTab.classList.toggle('active', !isNightmare);
    nightmareTab.classList.toggle('active', isNightmare);
    songListEl?.classList.toggle('hidden', isNightmare);
    nightmareListEl?.classList.toggle('hidden', !isNightmare);
    nightmareIntro?.classList.toggle('hidden', !isNightmare);
  }

  standardTab.addEventListener('click', () => showPlaySubtab('standard'));
  nightmareTab.addEventListener('click', () => showPlaySubtab('nightmare'));
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

function buildBossList() {
  if (!bossList) return;
  bossList.innerHTML = '';
  const mode = createBossMode();
  const weapon = getBossWeapon(Skins.getEquipped());
  const skin = Skins.getEquippedData();

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'training-mode-card boss-mode-card';
  card.innerHTML = `
    <div class="training-mode-icon" style="background: ${mode.color}"></div>
    <div class="training-mode-info">
      <div class="name">${mode.name}</div>
      <div class="meta">${mode.description}</div>
      <div class="meta">Equipped: ${skin.icon} ${skin.name} → <strong>${weapon.name}</strong></div>
      <div class="meta">Cursor move · auto-aim · rounds get harder</div>
    </div>
    <span class="training-tag boss-tag">Arena</span>
  `;
  card.addEventListener('click', () => startBossMode(mode));
  bossList.appendChild(card);
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
    boss: {
      tab: document.getElementById('tab-boss'),
      panel: document.getElementById('boss-panel'),
    },
    shop: {
      tab: document.getElementById('tab-shop'),
      panel: document.getElementById('shop-panel'),
    },
    skins: {
      tab: document.getElementById('tab-skins'),
      panel: document.getElementById('skins-panel'),
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
    renderLoadoutBar();
  });

  tabs.training.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('training');
    renderLoadoutBar();
  });

  tabs.dodge.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('dodge');
    renderLoadoutBar();
  });

  tabs.boss.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('boss');
    buildBossList();
    renderLoadoutBar();
  });

  tabs.shop.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('shop');
    refreshShopUI();
  });

  tabs.skins.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('skins');
    refreshSkinsUI();
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

function bindAbilityHud(game) {
  game.onAbilityUpdate = (abilities) => showAbilityHud(abilities);
}

async function startSong(song, isTraining, options = {}) {
  await audioEngine.resume();

  const isNightmare = !!options.nightmare && !isTraining;
  const mode = isTraining ? 'training' : 'play';
  const abilities = await prepareRunAbilities(mode);

  if (isTraining) lastTrainingSong = song;
  if (isNightmare) lastNightmareSong = song;

  hideMenu();
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');
  trainingBadge.classList.toggle('hidden', !isTraining);
  nightmareBadge.classList.toggle('hidden', !isNightmare);
  dodgeBadge.classList.add('hidden');
  bossBadge.classList.add('hidden');
  dodgeHealthHud.classList.add('hidden');
  trainingLevelHud.classList.toggle('hidden', !isTraining);
  showAbilityHud(abilities);
  bindAbilityHud(game);

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
  game.start(song, {
    training: isTraining,
    dodge: false,
    nightmare: isNightmare,
    abilities,
    skinId: Skins.getEquipped(),
  });

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

async function startBossMode(song) {
  await audioEngine.resume();
  const abilities = await prepareRunAbilities('boss');
  lastBossSong = song;

  hideMenu();
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');
  trainingBadge.classList.add('hidden');
  nightmareBadge.classList.add('hidden');
  dodgeBadge.classList.add('hidden');
  bossBadge.classList.remove('hidden');
  trainingLevelHud.classList.remove('hidden');
  dodgeHealthHud.classList.remove('hidden');
  const weapon = getBossWeapon(Skins.getEquipped());
  updateDodgeHealthHud(BOSS_PLAYER_HEALTH, BOSS_PLAYER_HEALTH);
  showAbilityHud(abilities);
  bindAbilityHud(game);

  songNameEl.textContent = `${song.name} · ${weapon.name}`;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');
  trainingLevelHud.textContent = 'Round 1';

  game.onScoreUpdate = ({ score, combo, rating, health, maxHealth, bossRound, bossHealth, bossMaxHealth, bossSkill, minionCount }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    const skillLabel = bossSkill ? ` · ${bossSkill}` : '';
    const enemyLabel = minionCount ? ` · ${minionCount} enemies` : '';
    trainingLevelHud.textContent = `Round ${bossRound || game.bossRound || 1}${skillLabel}${enemyLabel}`;
    if (health != null) updateDodgeHealthHud(health, maxHealth);
    progressFill.style.width = bossMaxHealth > 0
      ? `${((bossMaxHealth - (bossHealth ?? bossMaxHealth)) / bossMaxHealth) * 100}%`
      : '0%';

    if (rating === 'miss') {
      flashOverlay.className = rating;
      flashOverlay.style.opacity = '1';
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);
      showDodgeHitPopup();
    }
  };

  game.onComplete = (data) => showResults(data, true);
  game.onDodgeDefeat = (data) => showResults(data, true);
  game.onTrainingExit = () => finishBoss();
  game.onTrainingRestart = () => startBossMode(song);
  game.start(song, { training: false, dodge: false, boss: true, abilities, skinId: Skins.getEquipped() });
}

function finishBoss() {
  const data = game.getTrainingSummary();
  game.stop();
  showResults(data, true);
}

async function startDodgeMode(song) {
  await audioEngine.resume();
  const abilities = await prepareRunAbilities('dodge');
  lastDodgeSong = song;

  hideMenu();
  results.classList.add('hidden');
  results.classList.remove('active');
  hud.classList.remove('hidden');
  trainingBadge.classList.add('hidden');
  nightmareBadge.classList.add('hidden');
  dodgeBadge.classList.remove('hidden');
  bossBadge.classList.add('hidden');
  trainingLevelHud.classList.remove('hidden');
  dodgeHealthHud.classList.remove('hidden');
  updateDodgeHealthHud(DODGE_MAX_HEALTH, DODGE_MAX_HEALTH);
  showAbilityHud(abilities);
  bindAbilityHud(game);

  songNameEl.textContent = song.name;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');

  game.onScoreUpdate = ({ score, combo, rating, health, maxHealth }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    trainingLevelHud.textContent = `Level ${game.getTrainingLevel()}`;
    progressFill.style.width = `${game.getProgress() * 100}%`;
    if (health != null) updateDodgeHealthHud(health, maxHealth);

    if (rating === 'miss') {
      flashOverlay.className = rating;
      flashOverlay.style.opacity = '1';
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);
      showDodgeHitPopup();
    }
  };

  game.onComplete = (data) => showResults(data, true);
  game.onDodgeDefeat = (data) => showResults(data, true);
  game.onTrainingExit = () => finishDodge();
  game.onTrainingRestart = () => startDodgeMode(song);
  game.start(song, { training: false, dodge: true, abilities, skinId: Skins.getEquipped() });

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
  nightmareBadge.classList.add('hidden');
  dodgeBadge.classList.add('hidden');
  bossBadge.classList.add('hidden');
  dodgeHealthHud.classList.add('hidden');
  trainingLevelHud.classList.add('hidden');
  abilityHud.classList.add('hidden');

  const titleEl = document.getElementById('results-title');
  const gradeEl = document.getElementById('grade');
  const retryBtn = document.getElementById('retry-btn');
  const summaryLine = document.getElementById('training-summary-line');
  const levelWrap = document.getElementById('stat-level-wrap');
  const timeWrap = document.getElementById('stat-time-wrap');

  titleEl.textContent = data.defeated
    ? 'Defeated'
    : isTraining
      ? (data.boss ? 'Boss Fight Complete' : data.dodge ? 'Dodge Complete' : 'Training Complete')
      : (data.nightmare ? 'Nightmare Complete' : 'Song Complete');
  gradeEl.style.display = isTraining ? 'none' : 'block';
  summaryLine.classList.toggle('hidden', !isTraining);
  levelWrap.classList.toggle('hidden', !isTraining);
  timeWrap.classList.toggle('hidden', !isTraining);

  if (isTraining) {
    summaryLine.textContent = data.defeated
      ? (data.boss
        ? `Defeated on Round ${data.bossRound || data.trainingLevel} — ${data.stats.good || 0} hits landed`
        : `Health depleted at Level ${data.trainingLevel} — ${data.stats.excellent} dodged, ${data.stats.miss} hit`)
      : data.boss
        ? `Cleared ${(data.bossRound || data.trainingLevel) - 1} rounds — ${data.timeSurvived}s survived`
        : data.dodge
          ? `You reached Level ${data.trainingLevel} — ${data.stats.excellent} dodged, ${data.stats.miss} hit`
          : `You reached Level ${data.trainingLevel} in ${data.timeSurvived}s`;
    document.getElementById('stat-level').textContent = data.boss ? (data.bossRound || data.trainingLevel) : data.trainingLevel;
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
  const isBoss = !!data.boss;
  const isNightmare = !!data.nightmare || (songId && String(songId).startsWith('nightmare-'));
  const skinId = Skins.getEquipped();
  const skinPassives = Skins.getSkin(skinId)?.passives || {};

  try {
    const reward = await RUDWallet.completeGame({
      score: data.score,
      grade: data.grade,
      songId,
      isTraining: isTraining && !isDodge && !isBoss,
      isDodge,
      isBoss,
      isNightmare,
      trainingLevel: data.trainingLevel,
      bossRound: data.bossRound || data.trainingLevel || 0,
      dodged: data.stats?.excellent || 0,
      timeSurvived: data.timeSurvived || 0,
      activeAbilities: data.activeAbilities || [],
      skinId,
    });

    if (reward.earned > 0) {
      updateRudDisplay(true);

      let earnedText = `+${reward.earned.toLocaleString()} RUD earned`;
      if (skinPassives.rudMult) {
        earnedText += `<span class="rud-bonus">Skin RUD bonus</span>`;
      } else if (Array.isArray(data.activeAbilities) && data.activeAbilities.includes('rud-magnet')) {
        earnedText += `<span class="rud-bonus">RUD Magnet +20%</span>`;
      } else if (isNightmare && data.grade === 'S') {
        earnedText += `<span class="rud-bonus">Nightmare S rank!</span>`;
      } else if (reward.isNewBest && reward.bonus > 0) {
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
      isTraining: isTraining && !isDodge && !isBoss,
      isDodge,
      isBoss,
      isNightmare,
      trainingLevel: data.trainingLevel,
      bossRound: data.bossRound || data.trainingLevel || 0,
      songId,
      dodged: data.stats?.excellent || 0,
      timeSurvived: data.timeSurvived || 0,
      activeAbilities: data.activeAbilities || [],
      skinId,
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
    if (data.boss && lastBossSong) startBossMode(lastBossSong);
    else if (data.dodge && lastDodgeSong) startDodgeMode(lastDodgeSong);
    else if (lastTrainingSong) startSong(lastTrainingSong, true);
    else if (data.nightmare && lastNightmareSong) startSong(lastNightmareSong, false, { nightmare: true });
  };

  results.classList.remove('hidden');
  results.classList.add('active');
}

document.getElementById('back-btn').addEventListener('click', () => {
  game.stop();
  results.classList.remove('active');
  results.classList.add('hidden');
  trainingBadge.classList.add('hidden');
  nightmareBadge.classList.add('hidden');
  dodgeBadge.classList.add('hidden');
  bossBadge.classList.add('hidden');
  dodgeHealthHud.classList.add('hidden');
  trainingLevelHud.classList.add('hidden');
  abilityHud.classList.add('hidden');
  showMenu();
  renderLoadoutBar();
});

buildSongList();
buildNightmareList();
buildTrainingList();
buildDodgeList();
buildBossList();
buildShopList();
buildSkinsList();
buildSoundList();
setupMenuTabs();
setupPlaySubtabs();
renderLoadoutBar();
document.getElementById('sound-reset-btn').addEventListener('click', resetSoundProfile);
document.getElementById('shop-redeem-btn')?.addEventListener('click', redeemShopCode);
document.getElementById('shop-code-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    redeemShopCode();
  }
});
userForm.addEventListener('submit', handleUserSubmit);
userNameBtn.addEventListener('click', () => showUserModal());
changeAccountBtn.addEventListener('click', handleChangeAccount);
authTabLogin.addEventListener('click', () => setAuthMode('login'));
authTabRegister.addEventListener('click', () => setAuthMode('register'));
authChangeAccountBtn.addEventListener('click', handleChangeAccount);
initApp();
