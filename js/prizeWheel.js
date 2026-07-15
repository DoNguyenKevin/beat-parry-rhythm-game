const WHEEL_SPIN_COST = 150;
const SLOT_ITEM_H = 76;
const SLOT_VISIBLE = 3;

const WHEEL_PRIZES = [
  { id: 'rud-75', type: 'rud', amount: 75, weight: 20, label: '75 RUD', color: '#c9a227', icon: '🪙' },
  { id: 'rud-150', type: 'rud', amount: 150, weight: 16, label: '150 RUD', color: '#d4af37', icon: '🪙' },
  { id: 'rud-350', type: 'rud', amount: 350, weight: 9, label: '350 RUD', color: '#e6b422', icon: '💰' },
  { id: 'rud-750', type: 'rud', amount: 750, weight: 4, label: '750 RUD', color: '#f0a500', icon: '💎' },
  { id: 'skill-wide-window', type: 'ability', abilityId: 'wide-window', weight: 8, label: 'Steady Hands', color: '#4a7fd4', icon: '🎯' },
  { id: 'skill-combo-shield', type: 'ability', abilityId: 'combo-shield', weight: 7, label: 'Combo Shield', color: '#5b6fd6', icon: '🛡️' },
  { id: 'skill-score-boost', type: 'ability', abilityId: 'score-boost', weight: 6, label: 'Score Boost', color: '#7b5fd8', icon: '⚡' },
  { id: 'skill-rud-magnet', type: 'ability', abilityId: 'rud-magnet', weight: 5, label: 'RUD Magnet', color: '#3da8d4', icon: '🧲' },
  { id: 'skill-second-chance', type: 'ability', abilityId: 'second-chance', weight: 7, label: 'Second Chance', color: '#3db88a', icon: '♻️' },
  { id: 'skill-ghost-phase', type: 'ability', abilityId: 'ghost-phase', weight: 6, label: 'Ghost Phase', color: '#8b6fd4', icon: '👻' },
  { id: 'skill-long-warning', type: 'ability', abilityId: 'long-warning', weight: 6, label: 'Early Warning', color: '#d4883a', icon: '⚠️' },
  { id: 'skill-slow-start', type: 'ability', abilityId: 'slow-start', weight: 5, label: 'Calm Start', color: '#4db87a', icon: '🐢' },
  { id: 'bonus-spin', type: 'freeSpin', weight: 3, label: 'Bonus Spin', color: '#d44a9a', icon: '🔄' },
  { id: 'skin-neon', type: 'skin', skinId: 'skin-neon', fallbackRud: 350, weight: 2, label: 'Neon Pulse', color: '#0099bb', icon: '💠' },
  { id: 'skin-emerald', type: 'skin', skinId: 'skin-emerald', fallbackRud: 600, weight: 1, label: 'Emerald Guard', color: '#22aa66', icon: '💚' },
  { id: 'skin-solar', type: 'skin', skinId: 'skin-solar', fallbackRud: 900, weight: 1, label: 'Solar Crown', color: '#ffd700', icon: '👑' },
  { id: 'skin-inferno', type: 'skin', skinId: 'skin-inferno', fallbackRud: 1400, weight: 1, label: 'Inferno Core', color: '#ff5533', icon: '🔥' },
  { id: 'skin-fortune-crown', type: 'skin', skinId: 'skin-fortune-crown', fallbackRud: 1200, weight: 1, label: 'Fortune Crown', color: '#b8860b', icon: '🎰' },
];

const PrizeWheel = {
  prizes: WHEEL_PRIZES,
  spinning: false,
  reelStrips: [],
  reelOffsets: [0, 0, 0],
  wheelState: {
    freeSpinAvailable: false,
    wheelBonusSpins: 0,
    nextFreeSpinAt: null,
    spinCost: WHEEL_SPIN_COST,
  },

  init() {
    this.reelsEl = document.getElementById('slot-reels');
    if (!this.reelsEl) return;
    this.buildReels();
    this.buildPrizeList();
    this.bindControls();
    this.refreshUI();
  },

  buildReels() {
    this.reelsEl.innerHTML = '';
    this.reelStrips = [];
    this.reelOffsets = [0, 0, 0];

    for (let r = 0; r < 3; r++) {
      const reel = document.createElement('div');
      reel.className = 'slot-reel';
      const strip = document.createElement('div');
      strip.className = 'slot-reel-strip';
      reel.appendChild(strip);
      this.reelsEl.appendChild(reel);
      this.reelStrips.push(strip);
    }

    this.setIdleDisplay(0);
  },

  buildStripItems() {
    const items = [];
    const cycles = 18;
    for (let c = 0; c < cycles; c++) {
      for (const prize of this.prizes) items.push(prize);
    }
    return items;
  },

  maxStripOffset(items) {
    const stripH = items.length * SLOT_ITEM_H;
    const viewH = SLOT_ITEM_H * SLOT_VISIBLE;
    return Math.max(0, stripH - viewH);
  },

  clampStripOffset(offsetPx, items) {
    return Math.min(Math.max(0, offsetPx), this.maxStripOffset(items));
  },

  renderStrip(stripEl, items, offsetPx) {
    const clamped = this.clampStripOffset(offsetPx, items);
    stripEl.innerHTML = '';
    for (const prize of items) {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.style.setProperty('--cell-color', prize.color);
      cell.innerHTML = `
        <span class="slot-cell-icon">${prize.icon}</span>
        <span class="slot-cell-label">${prize.label}</span>
      `;
      stripEl.appendChild(cell);
    }
    stripEl.style.transform = `translate3d(0, ${-clamped}px, 0)`;
    return clamped;
  },

  offsetForPrize(prizeIndex, cycle = 5) {
    const n = this.prizes.length;
    const stripIndex = cycle * n + prizeIndex;
    return Math.max(0, (stripIndex - 1) * SLOT_ITEM_H);
  },

  cycleHeight() {
    return this.prizes.length * SLOT_ITEM_H;
  },

  /** Random up/down spin path that still lands on prizeIndex in the center row. */
  getReelSpinTarget(reelIndex, prizeIndex, startOffset) {
    const cycleH = this.cycleHeight();
    let direction = Math.random() < 0.5 ? 1 : -1;
    const loops = 3 + Math.floor(Math.random() * 4);
    let endOffset;

    if (direction === 1) {
      endOffset = this.offsetForPrize(prizeIndex, 5 + reelIndex + loops);
      while (endOffset <= startOffset) endOffset += cycleH;
    } else {
      endOffset = this.offsetForPrize(prizeIndex, Math.max(1, 2 + reelIndex));
      while (endOffset >= startOffset) endOffset -= cycleH;
      if (endOffset < 0) {
        direction = 1;
        endOffset = this.offsetForPrize(prizeIndex, 5 + reelIndex + loops);
        while (endOffset <= startOffset) endOffset += cycleH;
      }
    }

    const items = this.buildStripItems();
    const maxOffset = this.maxStripOffset(items);
    endOffset = Math.min(endOffset, maxOffset);

    return {
      endOffset,
      direction,
      duration: 2400 + Math.floor(Math.random() * 900),
    };
  },

  setIdleDisplay(prizeIndex) {
    const items = this.buildStripItems();
    const offset = this.clampStripOffset(this.offsetForPrize(prizeIndex, 3), items);
    for (const strip of this.reelStrips) {
      this.renderStrip(strip, items, offset);
    }
    this.reelOffsets = [offset, offset, offset];
  },

  setWheelState(state) {
    if (!state) return;
    this.wheelState = {
      freeSpinAvailable: !!state.freeSpinAvailable,
      wheelBonusSpins: state.wheelBonusSpins || 0,
      nextFreeSpinAt: state.nextFreeSpinAt || null,
      spinCost: state.spinCost || WHEEL_SPIN_COST,
    };
    this.refreshUI();
  },

  refreshUI() {
    const statusEl = document.getElementById('wheel-status');
    const freeBtn = document.getElementById('wheel-spin-free-btn');
    const paidBtn = document.getElementById('wheel-spin-paid-btn');
    const machine = document.querySelector('.slot-machine');
    if (!statusEl || !freeBtn || !paidBtn) return;

    const { freeSpinAvailable, wheelBonusSpins, nextFreeSpinAt, spinCost } = this.wheelState;
    const cost = spinCost || WHEEL_SPIN_COST;

    if (wheelBonusSpins > 0) {
      statusEl.textContent = `Bonus spins ready: ${wheelBonusSpins}`;
    } else if (freeSpinAvailable) {
      statusEl.textContent = 'Daily free spin available!';
    } else if (nextFreeSpinAt) {
      const remaining = new Date(nextFreeSpinAt).getTime() - Date.now();
      if (remaining > 0) {
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        statusEl.textContent = `Next free spin in ${hrs}h ${mins}m`;
      } else {
        statusEl.textContent = 'Daily free spin available!';
      }
    } else {
      statusEl.textContent = 'Daily free spin available!';
    }

    freeBtn.disabled = this.spinning || !freeSpinAvailable || !RUDWallet.userId;
    freeBtn.textContent = wheelBonusSpins > 0 ? 'Bonus Spin' : 'Free Spin';

    const canAfford = RUDWallet.balance >= cost;
    paidBtn.disabled = this.spinning || !RUDWallet.userId || !canAfford;
    paidBtn.textContent = `Spin (${cost} RUD)`;

    if (machine) machine.classList.toggle('slot-machine-spinning', this.spinning);
  },

  animateReel(reelIndex, prizeIndex) {
    return new Promise((resolve) => {
      const strip = this.reelStrips[reelIndex];
      const reel = strip?.parentElement;
      const items = this.buildStripItems();
      const startOffset = this.reelOffsets[reelIndex] || 0;
      const { endOffset, direction, duration } = this.getReelSpinTarget(reelIndex, prizeIndex, startOffset);

      const clampedStart = this.renderStrip(strip, items, startOffset);
      reel?.classList.remove('slot-reel-up', 'slot-reel-down');
      reel?.classList.add(direction === 1 ? 'slot-reel-down' : 'slot-reel-up');

      const startTime = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = slotEase(t);
        const current = this.clampStripOffset(
          clampedStart + (endOffset - clampedStart) * eased,
          items
        );
        strip.style.transform = `translate3d(0, ${-current}px, 0)`;

        if (t < 1) requestAnimationFrame(tick);
        else {
          this.reelOffsets[reelIndex] = endOffset;
          strip.style.transform = `translate3d(0, ${-endOffset}px, 0)`;
          reel?.classList.remove('slot-reel-up', 'slot-reel-down');
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  },

  async spinToIndex(index) {
    if (this.spinning) return;
    this.spinning = true;
    this.refreshUI();

    const frame = document.querySelector('.slot-machine-frame');
    frame?.classList.add('slot-machine-active');

    await Promise.all([
      this.animateReel(0, index),
      this.animateReel(1, index),
      this.animateReel(2, index),
    ]);

    frame?.classList.remove('slot-machine-active');
    frame?.classList.add('slot-machine-win');
    setTimeout(() => frame?.classList.remove('slot-machine-win'), 600);

    this.spinning = false;
    this.refreshUI();
  },

  showResult(prize) {
    const el = document.getElementById('wheel-result');
    if (!el || !prize) return;

    let msg = `${prize.icon || '🎁'} You won: ${prize.label}!`;
    if (prize.duplicate) msg = `${prize.icon || '🪙'} Already owned — ${prize.amount} RUD instead!`;
    if (prize.type === 'ability') msg = `${prize.icon || '⚡'} Skill unlocked: ${prize.label}! Check Inventory to equip.`;
    if (prize.type === 'skin') {
      const exclusive = prize.id === 'skin-fortune-crown' || prize.skinId === 'skin-fortune-crown';
      msg = exclusive
        ? `${prize.icon || '🎰'} JACKPOT! Exclusive Fortune Crown skin unlocked!`
        : `${prize.icon || '💠'} Skin unlocked: ${prize.label}! Check Skins tab.`;
    }
    if (prize.type === 'freeSpin') msg = `${prize.icon || '🔄'} Bonus spin earned — spin again for free!`;

    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.add('wheel-result-show');
    clearTimeout(this._resultTimer);
    this._resultTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('wheel-result-show');
    }, 4500);
  },

  async doSpin(useFree) {
    if (!RUDWallet.userId) throw new Error('Log in to spin the slot machine.');
    if (this.spinning) return null;

    const data = await RUDWallet.api(`/api/users/${RUDWallet.userId}/spin`, {
      method: 'POST',
      body: JSON.stringify({ useFree: !!useFree }),
    });

    RUDWallet.balance = data.balance;
    if (typeof Shop !== 'undefined' && data.inventory) Shop.setInventory(data.inventory);
    if (typeof Skins !== 'undefined' && data.ownedSkins) Skins.setOwned(data.ownedSkins);
    if (data.wheelState) this.setWheelState(data.wheelState);
    if (typeof updateRudDisplay === 'function') updateRudDisplay(true);
    if (typeof refreshShopUI === 'function') refreshShopUI();

    await this.spinToIndex(data.prizeIndex);
    this.showResult(data.prize);
    return data.prize;
  },

  async handleFreeSpin() {
    const errEl = document.getElementById('wheel-error');
    try {
      if (errEl) errEl.classList.add('hidden');
      await this.doSpin(true);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Spin failed.';
        errEl.classList.remove('hidden');
      }
    }
  },

  async handlePaidSpin() {
    const errEl = document.getElementById('wheel-error');
    try {
      if (errEl) errEl.classList.add('hidden');
      await this.doSpin(false);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Spin failed.';
        errEl.classList.remove('hidden');
      }
    }
  },

  buildPrizeList() {
    const list = document.getElementById('wheel-prize-list');
    if (!list) return;
    list.innerHTML = '';

    const groups = [
      { title: 'RUD', filter: (p) => p.type === 'rud' },
      { title: 'Skills', filter: (p) => p.type === 'ability' },
      { title: 'Skins & Bonus', filter: (p) => (p.type === 'skin' && p.id !== 'skin-fortune-crown') || p.type === 'freeSpin' },
      { title: 'Jackpot (Spin Only)', filter: (p) => p.id === 'skin-fortune-crown' },
    ];

    for (const group of groups) {
      const section = document.createElement('div');
      section.className = 'wheel-prize-group';
      const heading = document.createElement('h4');
      heading.textContent = group.title;
      section.appendChild(heading);

      const chips = document.createElement('div');
      chips.className = 'wheel-prize-chips';
      for (const prize of this.prizes.filter(group.filter)) {
        const chip = document.createElement('span');
        chip.className = 'wheel-prize-chip';
        chip.style.borderColor = prize.color;
        chip.textContent = `${prize.icon} ${prize.label}`;
        chips.appendChild(chip);
      }
      section.appendChild(chips);
      list.appendChild(section);
    }
  },

  bindControls() {
    document.getElementById('wheel-spin-free-btn')?.addEventListener('click', () => this.handleFreeSpin());
    document.getElementById('wheel-spin-paid-btn')?.addEventListener('click', () => this.handlePaidSpin());
  },
};

function slotEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.08) {
    const u = t / 0.08;
    return 0.04 * u;
  }
  const u = (t - 0.08) / 0.92;
  return 0.04 + 0.96 * (1 - Math.pow(1 - u, 4.8));
}
