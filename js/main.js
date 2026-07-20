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
  rudBalanceEl.textContent = formatRudShort(RUDWallet.balance);
  rudBalanceEl.title = `${Number(RUDWallet.balance).toLocaleString()} RUD`;
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
    if (typeof AdminPanel !== 'undefined') {
      AdminPanel.setVisible(RUDWallet.isAdmin);
      if (RUDWallet.isAdmin) AdminPanel.refresh();
    }
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

function blockIfMaintenance() {
  if (typeof GameConfig !== 'undefined' && GameConfig.maintenanceMode && !RUDWallet.isAdmin) {
    alert('Beat Parry is in maintenance mode. Please check back soon.');
    return true;
  }
  return false;
}

async function initApp() {
  if (typeof GameConfig !== 'undefined') await GameConfig.fetch();
  if (typeof AdminPanel !== 'undefined') AdminPanel.showAnnouncement();
  try {
    const { needsAuth } = await RUDWallet.init();
    if (needsAuth && typeof Shop !== 'undefined') {
      Shop.setSecretUnlocks([]);
    }
    updateRudDisplay(false);
    refreshShopUI();
    if (typeof AdminPanel !== 'undefined') {
      AdminPanel.setVisible(RUDWallet.isAdmin);
      if (RUDWallet.isAdmin) AdminPanel.refresh();
    }
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
  const electricSkin = Skins.getEquipped() === 'skin-electric';
  const equipped = Shop.equipped.filter((id) => {
    if (Shop.getQuantity(id) <= 0) return false;
    if (electricSkin && (id === 'op-overdrive' || id === 'op-void-dash')) return false;
    return true;
  });
  if (!equipped.length) {
    loadoutBar.innerHTML = electricSkin
      ? '<span class="loadout-empty">Electric skin — Beam & Boom only (no Overdrive / Void Dash)</span>'
      : '<span class="loadout-empty">No abilities equipped — visit Inventory</span>';
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

  const ownedItems = Shop.getItems().filter((item) => {
    if (item.secret) return Shop.isSecretUnlocked(item.id);
    return Shop.getQuantity(item.id) > 0;
  });

  if (!ownedItems.length) {
    shopList.innerHTML = '<p class="inventory-empty">No skills yet. Win abilities from the <strong>Spin</strong> tab, then equip them here.</p>';
    return;
  }

  for (const item of ownedItems) {
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    if (item.secret) card.classList.add('shop-item-secret');
    card.dataset.ability = item.id;
    const qty = Shop.getQuantity(item.id);
    const equipped = Shop.isEquipped(item.id);
    const blockedByElectric = Skins.getEquipped() === 'skin-electric'
      && (item.id === 'op-overdrive' || item.id === 'op-void-dash');
    const canEquip = !blockedByElectric && Shop.canEquip(item.id);
    const modes = item.modes.map(modeLabel).join(', ');
    const qtyLabel = item.secret ? 'Permanent' : `×${qty}`;
    const metaExtra = blockedByElectric
      ? '<div class="meta shop-modes">Unavailable while Electric skin is equipped</div>'
      : '';

    card.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="name">${item.name}</div>
        <div class="meta">${item.description}</div>
        <div class="meta shop-modes">For: ${modes}</div>
        ${metaExtra}
        <div class="shop-item-footer">
          <span class="shop-owned">Owned: <strong>${qtyLabel}</strong></span>
        </div>
      </div>
      <div class="shop-item-actions">
        <button type="button" class="btn btn-secondary btn-small shop-equip-btn" ${canEquip ? '' : 'disabled'}>${blockedByElectric ? 'Blocked' : equipped ? 'Equipped' : 'Equip'}</button>
      </div>
    `;

    card.querySelector('.shop-equip-btn').addEventListener('click', () => toggleEquipAbility(item.id));
    shopList.appendChild(card);
  }
}

function renderSkinBar() {
  if (!skinBar) return;
  const skin = Skins.getEquippedData();
  const passiveText = formatSkinPassives(skin.passives, { effect: skin.effect });
  skinBar.innerHTML = `<span class="skin-bar-chip" style="--skin-color: ${skin.colors?.primary || '#ff6b9d'}">${skin.icon} ${skin.name} · ${passiveText}</span>`;
}

function buildSkinsList() {
  const skinsList = document.getElementById('skins-list');
  if (!skinsList) return;
  skinsList.innerHTML = '';

  const ownedSkins = Skins.getList().filter((skin) => Skins.owns(skin.id));

  if (!ownedSkins.length) {
    skinsList.innerHTML = '<p class="inventory-empty">No skins yet. Win skins from the <strong>Spin</strong> tab.</p>';
    return;
  }

  for (const skin of ownedSkins) {
    const equipped = Skins.isEquipped(skin.id);
    const passiveText = formatSkinPassives(skin.passives, { effect: skin.effect });

    const card = document.createElement('div');
    card.className = 'shop-item-card skin-item-card';
    if (skin.secret) card.classList.add('shop-item-secret');
    if (skin.spinOnly) card.classList.add('shop-item-spin-only');
    if (skin.eventOnly) card.classList.add('shop-item-event');
    card.dataset.skin = skin.id;
    const previewStyle = skin.effect === 'cosmic'
      ? 'background: radial-gradient(circle at 30% 28%, #e8f4ff, #7b2cbf 35%, #3a0ca3 58%, #10002b 78%, #030109); box-shadow: 0 0 22px rgba(224, 64, 251, 0.55);'
      : skin.effect === 'fortune'
        ? 'background: radial-gradient(circle at 32% 26%, #fff8dc, #ffd700 32%, #ff9900 58%, #b8860b 78%, #3d2a00); box-shadow: 0 0 22px rgba(255, 215, 0, 0.55), inset 0 0 12px rgba(255, 248, 220, 0.35);'
        : skin.effect === 'juggernaut'
          ? 'background: radial-gradient(circle at 32% 26%, #ffdd55, #ff5500 36%, #661111 68%, #1a0505); box-shadow: 0 0 22px rgba(255, 85, 0, 0.5), inset 0 0 14px rgba(255, 51, 0, 0.25);'
          : skin.effect === 'electric'
            ? 'background: radial-gradient(circle at 32% 26%, #e8f8ff, #44ddff 34%, #8866ff 62%, #0a1628 82%); box-shadow: 0 0 22px rgba(68, 221, 255, 0.55), inset 0 0 14px rgba(170, 102, 255, 0.25);'
          : `background: radial-gradient(circle at 35% 35%, ${skin.colors?.accent || '#fff'}, ${skin.colors?.primary || '#ff6b9d'} 55%, ${skin.colors?.glow || '#ff6b9d'})`;
    card.innerHTML = `
      <div class="shop-item-icon skin-preview" style="${previewStyle}">${skin.icon}</div>
      <div class="shop-item-info">
        <div class="name">${skin.name}</div>
        <div class="meta">${skin.description}</div>
        <div class="meta shop-modes">Passive: ${passiveText}</div>
      </div>
      <div class="shop-item-actions">
        <button type="button" class="btn btn-secondary btn-small skin-equip-btn">${equipped ? 'Equipped' : 'Equip'}</button>
      </div>
    `;

    card.querySelector('.skin-equip-btn').addEventListener('click', () => equipSkin(skin.id));
    skinsList.appendChild(card);
  }
}

function refreshSkinsUI() {
  buildSkinsList();
  renderSkinBar();
}

async function equipSkin(skinId) {
  try {
    await Skins.equip(skinId);
    refreshShopUI();
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
  if (typeof PrizeWheel !== 'undefined') PrizeWheel.refreshUI();
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
        alert(`Equip up to ${MAX_EQUIPPED} skills at a time. Secret skills (Overdrive, Void Dash) are extra.`);
      }
      return;
    }
  }
  refreshShopUI();
}

function abilityKeyHint(id) {
  if (id === 'op-overdrive') return ' · SPACE';
  if (id === 'op-void-dash') return ' · V';
  if (id === 'electric-beam') return ' · Hold Q';
  if (id === 'electric-boom') return ' · E';
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
    const fortune = Skins.getEquipped() === 'skin-fortune-crown'
      && (id === 'op-overdrive' || id === 'op-void-dash');
    const juggernaut = Skins.getEquipped() === 'skin-juggernaut'
      && (id === 'op-overdrive' || id === 'op-void-dash');
    const electric = (id === 'electric-beam' || id === 'electric-boom')
      && Skins.getEquipped() === 'skin-electric';
    const cls = juggernaut
      ? 'ability-chip ability-chip-juggernaut'
      : electric
        ? 'ability-chip ability-chip-electric'
      : cosmic
        ? 'ability-chip ability-chip-cosmic'
        : fortune
          ? 'ability-chip ability-chip-fortune'
          : 'ability-chip';
    const suffix = juggernaut ? ' 🛡️' : electric ? ' ⚡' : cosmic ? ' ✦' : fortune ? ' 👑' : '';
    return `<span class="${cls}">${item?.icon || '✦'} ${item?.name || id}${hint}${suffix}</span>`;
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
  const invasionChance = typeof getInvasionChancePercent === 'function' ? getInvasionChancePercent() : 0;
  const invasionReady = typeof canTriggerInvasion === 'function' && canTriggerInvasion();
  const ownsJuggernaut = Skins.owns('skin-juggernaut');
  const ownsElectric = Skins.owns('skin-electric');
  const raidReady = typeof canStartElectricRaid === 'function' && canStartElectricRaid();

  const electricCard = document.createElement('button');
  electricCard.type = 'button';
  electricCard.className = 'training-mode-card electric-raid-card';
  if (!raidReady) electricCard.classList.add('electric-raid-cleared');
  electricCard.innerHTML = `
    <div class="training-mode-icon electric-raid-icon">${ELECTRIC_RAID?.icon || '⚡'}</div>
    <div class="training-mode-info">
      <div class="name">${ELECTRIC_RAID?.name || 'Thunder Vault Raid'}</div>
      <div class="meta">${ELECTRIC_RAID?.description || 'Insanely hard lightning colossus.'}</div>
      <div class="meta">${ownsElectric ? '✓ Electric skin unlocked — equip it for Beam (Q) & Boom (E)' : 'Reward: Electric skin + both skills (below Juggernaut power)'}</div>
    </div>
    <span class="training-tag electric-raid-tag">${raidReady ? 'RAID' : 'CLEARED'}</span>
  `;
  electricCard.addEventListener('click', async () => {
    if (!raidReady) return;
    await showElectricRaidIntro();
    startElectricRaid();
  });
  bossList.appendChild(electricCard);

  const eventCard = document.createElement('div');
  eventCard.className = 'juggernaut-event-info';
  if (ownsJuggernaut) eventCard.classList.add('juggernaut-event-cleared');
  eventCard.innerHTML = `
    <div class="training-mode-icon juggernaut-event-icon">${JUGGERNAUT_EVENT?.icon || '☄️'}</div>
    <div class="training-mode-info">
      <div class="name">${JUGGERNAUT_EVENT?.name || 'Juggernaut Invasion'}</div>
      <div class="meta">${JUGGERNAUT_EVENT?.description || 'Rare random boss ambush.'}</div>
      <div class="meta">Equip <strong>Overdrive + Void Dash</strong> — then enter Boss Fight for a <strong>${invasionChance}%</strong> ambush chance${typeof hasOpSkinEquipped === 'function' && hasOpSkinEquipped() ? ' (boosted by OP skin)' : ''}</div>
      <div class="meta">${ownsJuggernaut ? '✓ Juggernaut skin unlocked' : 'Reward: Juggernaut skin (Fortune-tier, below Void God)'}</div>
    </div>
    <span class="training-tag juggernaut-event-tag">${invasionReady ? `${invasionChance}%` : 'LOCKED'}</span>
  `;
  bossList.appendChild(eventCard);

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
  card.addEventListener('click', async () => {
    if (typeof rollInvasion === 'function' && rollInvasion()) {
      await showInvasionIntro();
      startJuggernautEvent();
      return;
    }
    startBossMode(mode);
  });
  bossList.appendChild(card);
}

function showInvasionIntro() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'juggernaut-invasion-intro';
    overlay.innerHTML = `
      <div class="juggernaut-invasion-intro-inner">
        <div class="juggernaut-invasion-intro-icon">☄️</div>
        <div class="juggernaut-invasion-intro-title">JUGGERNAUT INVASION</div>
        <div class="juggernaut-invasion-intro-sub">The titan has ambushed your arena!</div>
      </div>
    `;
    document.getElementById('app').appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 450);
    }, 2400);
  });
}

function showElectricRaidIntro() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'electric-raid-intro';
    overlay.innerHTML = `
      <div class="electric-raid-intro-inner">
        <div class="electric-raid-intro-icon">⚡</div>
        <div class="electric-raid-intro-title">THUNDER VAULT RAID</div>
        <div class="electric-raid-intro-sub">Storm Colossus awaits — survive Hyperion Cascade!</div>
      </div>
    `;
    document.getElementById('app').appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 450);
    }, 2400);
  });
}

async function startElectricRaid() {
  if (blockIfMaintenance()) return;
  if (typeof canStartElectricRaid === 'function' && !canStartElectricRaid()) return;
  await audioEngine.resume();
  const song = typeof createElectricRaidSong === 'function' ? createElectricRaidSong() : createBossMode();
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

  songNameEl.textContent = `⚡ ${song.name} · ${weapon.name}`;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');
  trainingLevelHud.textContent = 'STORM COLOSSUS';

  game.onScoreUpdate = ({ score, combo, rating, health, maxHealth, bossHealth, bossMaxHealth, bossSkill, minionCount }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    const skillLabel = bossSkill ? ` · ${bossSkill}` : '';
    const enemyLabel = minionCount ? ` · ${minionCount} enemies` : '';
    trainingLevelHud.textContent = `STORM COLOSSUS${skillLabel}${enemyLabel}`;
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

  game.onElectricRaidVictory = (data) => showResults(data, true);
  game.onComplete = (data) => showResults(data, true);
  game.onDodgeDefeat = (data) => showResults(data, true);
  game.onTrainingExit = () => finishBoss();
  game.onTrainingRestart = () => startElectricRaid();
  game.start(song, { training: false, dodge: false, boss: true, electricRaidEvent: true, abilities, skinId: Skins.getEquipped() });
}

async function startJuggernautEvent() {
  if (blockIfMaintenance()) return;
  if (typeof canTriggerInvasion === 'function' && !canTriggerInvasion()) {
    startBossMode(createBossMode());
    return;
  }
  await audioEngine.resume();
  const song = typeof createJuggernautSong === 'function' ? createJuggernautSong() : createBossMode();
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

  songNameEl.textContent = `☄️ ${song.name} · ${weapon.name}`;
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  progressFill.style.width = '0%';
  scoreEl.parentElement.classList.remove('penalty');
  trainingLevelHud.textContent = 'THE JUGGERNAUT';

  game.onScoreUpdate = ({ score, combo, rating, health, maxHealth, bossHealth, bossMaxHealth, bossSkill, minionCount }) => {
    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;
    const skillLabel = bossSkill ? ` · ${bossSkill}` : '';
    const enemyLabel = minionCount ? ` · ${minionCount} enemies` : '';
    trainingLevelHud.textContent = `JUGGERNAUT${skillLabel}${enemyLabel}`;
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

  game.onJuggernautVictory = (data) => showResults(data, true);
  game.onComplete = (data) => showResults(data, true);
  game.onDodgeDefeat = (data) => showResults(data, true);
  game.onTrainingExit = () => finishBoss();
  game.onTrainingRestart = () => startJuggernautEvent();
  game.start(song, { training: false, dodge: false, boss: true, juggernautEvent: true, abilities, skinId: Skins.getEquipped() });
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
    wheel: {
      tab: document.getElementById('tab-wheel'),
      panel: document.getElementById('wheel-panel'),
    },
    skins: {
      tab: document.getElementById('tab-skins'),
      panel: document.getElementById('skins-panel'),
    },
    sounds: {
      tab: document.getElementById('tab-sounds'),
      panel: document.getElementById('sounds-panel'),
    },
    admin: {
      tab: document.getElementById('tab-admin'),
      panel: document.getElementById('admin-panel'),
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

  tabs.wheel.tab.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel('wheel');
    if (typeof PrizeWheel !== 'undefined') {
      PrizeWheel.refreshUI();
    }
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

  if (tabs.admin.tab) {
    tabs.admin.tab.addEventListener('click', (e) => {
      e.stopPropagation();
      showPanel('admin');
      if (typeof AdminPanel !== 'undefined') AdminPanel.refresh();
    });
  }
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
  if (blockIfMaintenance()) return;
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
  if (blockIfMaintenance()) return;
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
  if (blockIfMaintenance()) return;
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

  titleEl.textContent = data.electricRaidVictory
    ? 'Storm Colossus Defeated!'
    : data.juggernautVictory
    ? 'Juggernaut Defeated!'
    : data.defeated
    ? 'Defeated'
    : isTraining
      ? (data.electricRaidEvent ? 'Thunder Vault Raid' : data.juggernautEvent ? 'Juggernaut Invasion' : data.boss ? 'Boss Fight Complete' : data.dodge ? 'Dodge Complete' : 'Training Complete')
      : (data.nightmare ? 'Nightmare Complete' : 'Song Complete');
  gradeEl.style.display = isTraining ? 'none' : 'block';
  summaryLine.classList.toggle('hidden', !isTraining);
  levelWrap.classList.toggle('hidden', !isTraining);
  timeWrap.classList.toggle('hidden', !isTraining);

  if (isTraining) {
    summaryLine.textContent = data.electricRaidVictory
      ? 'You earned the Electric skin! Equip it and use Q (Beam) + E (Boom) in all modes.'
      : data.juggernautVictory
      ? 'You earned the Juggernaut skin! Equip it with Overdrive + Void Dash for Titan abilities.'
      : data.defeated
      ? (data.electricRaidEvent
        ? 'Storm Colossus overwhelmed you — this raid is insanely hard. Try again!'
        : data.juggernautEvent
        ? 'The Juggernaut crushed you — try again with both OP skills equipped.'
        : data.boss
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
      juggernautVictory: !!data.juggernautVictory,
      electricRaidVictory: !!data.electricRaidVictory,
    });

    if (reward.electricRaidUnlocked && typeof Skins !== 'undefined') {
      Skins.setOwned(reward.ownedSkins || [...Skins.owned, 'skin-electric']);
      if (typeof Shop !== 'undefined') {
        if (reward.secretUnlocks) Shop.setSecretUnlocks(reward.secretUnlocks);
        Shop.equipUnlockedSecrets(['electric-beam', 'electric-boom']);
      }
      buildSkinsList();
      buildBossList();
      refreshShopUI();
    } else if (reward.juggernautUnlocked && typeof Skins !== 'undefined') {
      Skins.setOwned(reward.ownedSkins || [...Skins.owned, 'skin-juggernaut']);
      buildSkinsList();
      buildBossList();
    } else if (reward.ownedSkins && typeof Skins !== 'undefined') {
      Skins.setOwned(reward.ownedSkins);
    }

    if (data.electricRaidVictory) {
      let earnedText = reward.electricRaidUnlocked
        ? '⚡ <strong>Electric skin unlocked!</strong> Beam & Boom skills ready — check Skins + Shop.'
        : '⚡ Thunder Vault cleared!';
      if (reward.earned > 0) {
        earnedText += ` +${reward.earned.toLocaleString()} RUD`;
      }
      rudEarnedEl.innerHTML = earnedText;
      rudEarnedEl.classList.remove('hidden');
    } else if (data.juggernautVictory) {
      let earnedText = reward.juggernautUnlocked
        ? '🛡️ <strong>Juggernaut skin unlocked!</strong> Check the Skins tab.'
        : '🛡️ Juggernaut victory!';
      if (reward.earned > 0) {
        earnedText += ` +${reward.earned.toLocaleString()} RUD`;
      }
      rudEarnedEl.innerHTML = earnedText;
      rudEarnedEl.classList.remove('hidden');
    } else if (reward.earned > 0) {
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
    if (data.electricRaidEvent && lastBossSong?.electricRaid) startElectricRaid();
    else if (data.juggernautEvent && lastBossSong?.juggernaut) startJuggernautEvent();
    else if (data.boss && lastBossSong) startBossMode(lastBossSong);
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
if (typeof PrizeWheel !== 'undefined') PrizeWheel.init();
if (typeof AdminPanel !== 'undefined') AdminPanel.init();
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
