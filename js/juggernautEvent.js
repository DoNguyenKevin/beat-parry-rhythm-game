const OP_SKIN_IDS = ['skin-fortune-crown', 'skin-void-god'];
const OP_ABILITY_IDS = ['op-overdrive', 'op-void-dash'];
const JUGGERNAUT_SKIN_ID = 'skin-juggernaut';

const JUGGERNAUT_EVENT = {
  id: 'juggernaut-invasion',
  name: 'Juggernaut Invasion',
  description: 'Rare random event during Boss Fight. A colossal titan ambushes you — beat it to earn the Juggernaut skin.',
  color: '#ff3300',
  icon: '☄️',
};

function hasBothOpAbilitiesEquipped() {
  if (typeof Shop === 'undefined') return false;
  return OP_ABILITY_IDS.every((id) => Shop.isEquipped(id) && Shop.isSecretUnlocked(id));
}

function hasOpSkinEquipped() {
  if (typeof Skins === 'undefined') return false;
  return OP_SKIN_IDS.includes(Skins.getEquipped());
}

function ownsBothOpSkins() {
  if (typeof Skins === 'undefined') return false;
  return OP_SKIN_IDS.every((id) => Skins.owns(id));
}

function getInvasionChancePercent() {
  if (!hasBothOpAbilitiesEquipped()) return 0;
  if (typeof Skins !== 'undefined' && Skins.owns(JUGGERNAUT_SKIN_ID)) return 0;
  let chance = 6;
  if (hasOpSkinEquipped()) chance = 18;
  if (ownsBothOpSkins()) chance = 28;
  return chance;
}

function rollInvasion() {
  const pct = getInvasionChancePercent();
  if (pct <= 0) return false;
  return Math.random() * 100 < pct;
}

function canTriggerInvasion() {
  return hasBothOpAbilitiesEquipped()
    && (typeof Skins === 'undefined' || !Skins.owns(JUGGERNAUT_SKIN_ID));
}

function createJuggernautSong() {
  return {
    id: 'juggernaut-invasion',
    name: JUGGERNAUT_EVENT.name,
    bpm: 110,
    duration: 3600,
    color: JUGGERNAUT_EVENT.color,
    bassFreq: 38,
    melodyScale: [0, 3, 7, 10],
    juggernaut: true,
  };
}
