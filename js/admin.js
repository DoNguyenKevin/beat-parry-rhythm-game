const AdminPanel = {
  config: null,
  users: [],

  init() {
    this.panel = document.getElementById('admin-panel');
    this.tab = document.getElementById('tab-admin');
    if (!this.panel || !this.tab) return;
    this.tab.classList.add('hidden');
    this.buildShell();
    this.bindTabs();
  },

  setVisible(isAdmin) {
    if (this.tab) this.tab.classList.toggle('hidden', !isAdmin);
  },

  async refresh() {
    if (!RUDWallet.isAdmin) return;
    try {
      const [cfgData, statsData] = await Promise.all([
        RUDWallet.api('/api/admin/config'),
        RUDWallet.api('/api/admin/stats'),
      ]);
      this.config = cfgData.config;
      this.effectivePrizes = cfgData.effectivePrizes;
      this.stats = statsData;
      this.renderOverview();
      this.renderLuckSection();
      this.renderSpeedSection();
      this.renderEconomySection();
      await this.loadUsers();
    } catch (err) {
      this.setMsg(err.message, true);
    }
  },

  buildShell() {
    this.panel.innerHTML = `
      <p class="shop-intro admin-intro">Server controls — luck, speeds, economy, and user management. Changes apply live for all players.</p>
      <div id="admin-msg" class="admin-msg hidden"></div>
      <div class="admin-subtabs">
        <button type="button" class="admin-subtab active" data-admin-tab="overview">Overview</button>
        <button type="button" class="admin-subtab" data-admin-tab="luck">Luck & Wheel</button>
        <button type="button" class="admin-subtab" data-admin-tab="speed">Speeds</button>
        <button type="button" class="admin-subtab" data-admin-tab="economy">Economy</button>
        <button type="button" class="admin-subtab" data-admin-tab="users">Users</button>
      </div>
      <div id="admin-tab-overview" class="admin-section"></div>
      <div id="admin-tab-luck" class="admin-section hidden"></div>
      <div id="admin-tab-speed" class="admin-section hidden"></div>
      <div id="admin-tab-economy" class="admin-section hidden"></div>
      <div id="admin-tab-users" class="admin-section hidden"></div>
    `;
  },

  bindTabs() {
    this.panel?.querySelectorAll('.admin-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.admin-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        this.panel.querySelectorAll('.admin-section').forEach((s) => s.classList.add('hidden'));
        document.getElementById(`admin-tab-${btn.dataset.adminTab}`)?.classList.remove('hidden');
      });
    });
  },

  setMsg(text, isError = false) {
    const el = document.getElementById('admin-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('error', isError);
  },

  sliderRow(key, label, min, max, step, format) {
    const val = this.config?.[key] ?? 1;
    return `
      <div class="admin-row">
        <label class="admin-label">${label}</label>
        <input type="range" class="admin-slider" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}" />
        <span class="admin-val" data-for="${key}">${format ? format(val) : val}</span>
      </div>
    `;
  },

  bindSliders(container, onSave) {
    container.querySelectorAll('.admin-slider').forEach((slider) => {
      const key = slider.dataset.key;
      const valEl = container.querySelector(`[data-for="${key}"]`);
      slider.addEventListener('input', () => {
        if (valEl) valEl.textContent = slider.value;
      });
    });
    container.querySelector('.admin-save-btn')?.addEventListener('click', onSave);
  },

  renderOverview() {
    const el = document.getElementById('admin-tab-overview');
    if (!el || !this.stats) return;
    const c = this.config || {};
    el.innerHTML = `
      <div class="admin-cards">
        <div class="admin-card"><span class="admin-card-label">Players</span><strong>${this.stats.users}</strong></div>
        <div class="admin-card"><span class="admin-card-label">Total RUD</span><strong title="${Number(this.stats.totalRud).toLocaleString()}">${formatRudShort(this.stats.totalRud)}</strong></div>
        <div class="admin-card"><span class="admin-card-label">Wheel luck</span><strong>${c.wheelLuckMult}x</strong></div>
        <div class="admin-card"><span class="admin-card-label">Maintenance</span><strong>${c.maintenanceMode ? 'ON' : 'Off'}</strong></div>
      </div>
      <div class="admin-block">
        <h3>Announcement</h3>
        <textarea id="admin-announcement" class="admin-textarea" maxlength="280" placeholder="Message shown to all players in menu">${c.announcement || ''}</textarea>
        <label class="admin-check"><input type="checkbox" id="admin-maintenance" ${c.maintenanceMode ? 'checked' : ''} /> Maintenance mode (blocks starting games)</label>
        <button type="button" class="btn btn-small admin-save-overview">Save broadcast</button>
      </div>
      <div class="admin-block">
        <h3>Quick presets</h3>
        <div class="admin-preset-row">
          <button type="button" class="btn btn-secondary btn-small" data-preset="normal">Normal</button>
          <button type="button" class="btn btn-secondary btn-small" data-preset="generous">Generous luck</button>
          <button type="button" class="btn btn-secondary btn-small" data-preset="hard">Hard mode speeds</button>
          <button type="button" class="btn btn-secondary btn-small" data-preset="easy">Easy mode speeds</button>
        </div>
      </div>
    `;

    el.querySelector('.admin-save-overview')?.addEventListener('click', () => this.saveConfig({
      announcement: document.getElementById('admin-announcement')?.value || '',
      maintenanceMode: !!document.getElementById('admin-maintenance')?.checked,
    }));

    el.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset));
    });
  },

  renderLuckSection() {
    const el = document.getElementById('admin-tab-luck');
    if (!el || !this.config) return;
    const c = this.config;
    el.innerHTML = `
      <div class="admin-block">
        <h3>Global luck multiplier</h3>
        <p class="admin-hint">Boosts rare prizes (skins, skills, high RUD). 1 = default, 2 = double rare odds.</p>
        ${this.sliderRow('wheelLuckMult', 'Luck', 0.25, 5, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
      </div>
      <div class="admin-block">
        <h3>Wheel economy</h3>
        <div class="admin-row">
          <label class="admin-label">Spin cost (RUD)</label>
          <input type="number" class="admin-input" id="admin-spin-cost" min="0" max="5000" value="${c.wheelSpinCost}" />
        </div>
        <div class="admin-row">
          <label class="admin-label">Free spin cooldown (hours)</label>
          <input type="number" class="admin-input" id="admin-free-hours" min="1" max="168" value="${c.freeSpinHours}" />
        </div>
      </div>
      <div class="admin-block">
        <h3>Effective prize weights (with luck)</h3>
        <div class="admin-weight-list">${(this.effectivePrizes || []).map((p) =>
          `<span class="wheel-prize-chip" style="border-color:${p.color}">${p.icon} ${p.label}: <strong>${p.weight.toFixed(1)}</strong></span>`
        ).join('')}</div>
      </div>
      <button type="button" class="btn admin-save-btn">Save luck & wheel</button>
    `;

    this.bindSliders(el, () => this.saveConfig({
      wheelLuckMult: Number(el.querySelector('[data-key="wheelLuckMult"]')?.value) || 1,
      wheelSpinCost: Number(document.getElementById('admin-spin-cost')?.value) || 150,
      freeSpinHours: Number(document.getElementById('admin-free-hours')?.value) || 24,
    }));
  },

  renderSpeedSection() {
    const el = document.getElementById('admin-tab-speed');
    if (!el || !this.config) return;
    el.innerHTML = `
      <div class="admin-block">
        <h3>Mode speed multipliers</h3>
        <p class="admin-hint">1 = default. Higher = faster notes, bullets, and boss attacks.</p>
        ${this.sliderRow('speedPlay', 'Play / Nightmare', 0.25, 3, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
        ${this.sliderRow('speedTraining', 'Training', 0.25, 3, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
        ${this.sliderRow('speedDodge', 'Dodge', 0.25, 3, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
        ${this.sliderRow('speedBoss', 'Boss', 0.25, 3, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
      </div>
      <div class="admin-block">
        <h3>Level ramp intervals</h3>
        <p class="admin-hint">Seconds between difficulty level-ups. Lower = ramps faster.</p>
        <div class="admin-row">
          <label class="admin-label">Training level every (sec)</label>
          <input type="number" class="admin-input" id="admin-train-interval" min="3" max="60" value="${this.config.trainingLevelInterval}" />
        </div>
        <div class="admin-row">
          <label class="admin-label">Dodge level every (sec)</label>
          <input type="number" class="admin-input" id="admin-dodge-interval" min="2" max="30" value="${this.config.dodgeLevelInterval}" />
        </div>
      </div>
      <button type="button" class="btn admin-save-btn">Save speeds</button>
    `;

    this.bindSliders(el, () => this.saveConfig({
      speedPlay: Number(el.querySelector('[data-key="speedPlay"]')?.value) || 1,
      speedTraining: Number(el.querySelector('[data-key="speedTraining"]')?.value) || 1,
      speedDodge: Number(el.querySelector('[data-key="speedDodge"]')?.value) || 1,
      speedBoss: Number(el.querySelector('[data-key="speedBoss"]')?.value) || 1,
      trainingLevelInterval: Number(document.getElementById('admin-train-interval')?.value) || 9,
      dodgeLevelInterval: Number(document.getElementById('admin-dodge-interval')?.value) || 4,
    }));
  },

  renderEconomySection() {
    const el = document.getElementById('admin-tab-economy');
    if (!el || !this.config) return;
    el.innerHTML = `
      <div class="admin-block">
        <h3>Global RUD multiplier</h3>
        <p class="admin-hint">Applied to all RUD earned from completing runs.</p>
        ${this.sliderRow('rudMultGlobal', 'RUD earned', 0.25, 3, 0.05, (v) => `${Number(v).toFixed(2)}x`)}
      </div>
      <button type="button" class="btn admin-save-btn">Save economy</button>
    `;
    this.bindSliders(el, () => this.saveConfig({
      rudMultGlobal: Number(el.querySelector('[data-key="rudMultGlobal"]')?.value) || 1,
    }));
  },

  async loadUsers(q = '') {
    const el = document.getElementById('admin-tab-users');
    if (!el) return;
    const [userData, adminData] = await Promise.all([
      RUDWallet.api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      RUDWallet.api('/api/admin/admins'),
    ]);
    this.users = userData.users || [];
    this.admins = adminData.admins || [];
    this.renderUsers(el);
  },

  async setUserAdmin(userId, grant) {
    const data = await RUDWallet.api(`/api/admin/users/${userId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ grant }),
    });
    this.setMsg(grant
      ? `${data.username} is now an admin.`
      : `Admin access removed from ${data.username}.`);
    await this.loadUsers(document.getElementById('admin-user-search')?.value || '');
  },

  renderUsers(container) {
    container.innerHTML = `
      <div class="admin-block">
        <h3>Admin roles</h3>
        <p class="admin-hint">Grant or revoke admin panel access. Admins can control luck, speeds, economy, and other players.</p>
        <div class="admin-admin-list">
          ${(this.admins || []).map((a) => `
            <span class="admin-admin-chip">${a.username}${a.id === RUDWallet.userId ? ' (you)' : ''}</span>
          `).join('') || '<span class="admin-hint">No admins yet.</span>'}
        </div>
      </div>
      <div class="admin-block">
        <h3>User management</h3>
        <div class="admin-search-row">
          <input type="text" id="admin-user-search" class="admin-input" placeholder="Search username..." />
          <button type="button" class="btn btn-small" id="admin-user-search-btn">Search</button>
        </div>
        <div class="admin-user-list">
          ${this.users.map((u) => `
            <div class="admin-user-card" data-user-id="${u.id}">
              <div class="admin-user-head">
                <strong>${u.username}</strong>
                ${u.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                <span class="admin-user-rud" title="${u.rud_balance.toLocaleString()} RUD">${formatRudShort(u.rud_balance)} RUD</span>
              </div>
              <div class="admin-user-meta">ID ${u.id} · Bonus spins: ${u.wheel_bonus_spins || 0}</div>
              <div class="admin-user-actions">
                ${u.isAdmin
                  ? `<button type="button" class="btn btn-small btn-secondary" data-action="revoke-admin" ${u.id === RUDWallet.userId ? 'disabled title="Cannot revoke yourself"' : ''}>Revoke admin</button>`
                  : '<button type="button" class="btn btn-small" data-action="grant-admin">Make admin</button>'}
                <input type="number" class="admin-input admin-input-sm" placeholder="+RUD" data-rud-delta />
                <button type="button" class="btn btn-small btn-secondary" data-action="add-rud">Add RUD</button>
                <button type="button" class="btn btn-small btn-secondary" data-action="reset-spin">Free spin</button>
                <button type="button" class="btn btn-small btn-secondary" data-action="grant-spin">+1 bonus spin</button>
              </div>
              <div class="admin-user-grant">
                <select class="admin-input admin-input-sm" data-grant-ability>
                  <option value="">Grant skill...</option>
                  ${Object.keys(SHOP_ITEMS).filter((id) => !SHOP_ITEMS[id].secret).map((id) =>
                    `<option value="${id}">${SHOP_ITEMS[id].name}</option>`
                  ).join('')}
                </select>
                <button type="button" class="btn btn-small" data-action="grant-ability">Grant</button>
              </div>
            </div>
          `).join('') || '<p class="admin-hint">No users found.</p>'}
        </div>
      </div>
    `;

    container.querySelector('#admin-user-search-btn')?.addEventListener('click', () => {
      this.loadUsers(document.getElementById('admin-user-search')?.value || '');
    });
    container.querySelector('#admin-user-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.loadUsers(e.target.value || '');
    });

    container.querySelectorAll('.admin-user-card').forEach((card) => {
      const userId = card.dataset.userId;
      card.querySelector('[data-action="grant-admin"]')?.addEventListener('click', async () => {
        if (!confirm('Grant admin access to this player?')) return;
        await this.setUserAdmin(userId, true);
      });
      card.querySelector('[data-action="revoke-admin"]')?.addEventListener('click', async () => {
        if (!confirm('Remove admin access from this player?')) return;
        await this.setUserAdmin(userId, false);
      });
      card.querySelector('[data-action="add-rud"]')?.addEventListener('click', async () => {
        const amount = Number(card.querySelector('[data-rud-delta]')?.value) || 0;
        if (!amount) return;
        await RUDWallet.api(`/api/admin/users/${userId}/rud`, {
          method: 'POST',
          body: JSON.stringify({ amount }),
        });
        this.setMsg(`Added ${amount} RUD to user ${userId}`);
        await this.loadUsers(document.getElementById('admin-user-search')?.value || '');
      });
      card.querySelector('[data-action="reset-spin"]')?.addEventListener('click', async () => {
        await RUDWallet.api(`/api/admin/users/${userId}/reset-spin`, { method: 'POST', body: '{}' });
        this.setMsg(`Reset free spin for user ${userId}`);
        await this.loadUsers(document.getElementById('admin-user-search')?.value || '');
      });
      card.querySelector('[data-action="grant-spin"]')?.addEventListener('click', async () => {
        await RUDWallet.api(`/api/admin/users/${userId}/grant`, {
          method: 'POST',
          body: JSON.stringify({ bonusSpins: 1 }),
        });
        this.setMsg(`Granted bonus spin to user ${userId}`);
        await this.loadUsers(document.getElementById('admin-user-search')?.value || '');
      });
      card.querySelector('[data-action="grant-ability"]')?.addEventListener('click', async () => {
        const abilityId = card.querySelector('[data-grant-ability]')?.value;
        if (!abilityId) return;
        await RUDWallet.api(`/api/admin/users/${userId}/grant`, {
          method: 'POST',
          body: JSON.stringify({ abilityId, quantity: 1 }),
        });
        this.setMsg(`Granted ${abilityId} to user ${userId}`);
      });
    });
  },

  async saveConfig(partial) {
    try {
      const data = await RUDWallet.api('/api/admin/config', {
        method: 'PATCH',
        body: JSON.stringify(partial),
      });
      this.config = data.config;
      GameConfig.apply(data.config);
      if (typeof PrizeWheel !== 'undefined') PrizeWheel.setWheelState({
        ...PrizeWheel.wheelState,
        spinCost: data.config.wheelSpinCost,
      });
      if (typeof PrizeWheel !== 'undefined') PrizeWheel.refreshUI();
      this.renderOverview();
      this.renderLuckSection();
      this.setMsg('Settings saved — live for all players.');
      this.showAnnouncement();
    } catch (err) {
      this.setMsg(err.message, true);
    }
  },

  async applyPreset(name) {
    const presets = {
      normal: {
        wheelLuckMult: 1, speedPlay: 1, speedTraining: 1, speedDodge: 1, speedBoss: 1, rudMultGlobal: 1,
      },
      generous: { wheelLuckMult: 2.5, rudMultGlobal: 1.5 },
      hard: { speedPlay: 1.4, speedTraining: 1.35, speedDodge: 1.5, speedBoss: 1.45, trainingLevelInterval: 7, dodgeLevelInterval: 3 },
      easy: { speedPlay: 0.75, speedTraining: 0.8, speedDodge: 0.7, speedBoss: 0.75, trainingLevelInterval: 12, dodgeLevelInterval: 6 },
    };
    if (!presets[name]) return;
    await this.saveConfig(presets[name]);
    await this.refresh();
  },

  showAnnouncement() {
    const bar = document.getElementById('admin-announcement-bar');
    if (!bar) return;
    const msg = GameConfig.announcement?.trim();
    if (msg) {
      bar.textContent = msg;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  },
};
