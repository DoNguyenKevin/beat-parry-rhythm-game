const ELECTRIC_RAID = {
  id: 'electric-raid',
  name: 'Thunder Vault Raid',
  description: 'Insanely hard lightning colossus. Clear it once to earn the Electric skin + Beam & Boom skills.',
  color: '#44ddff',
  icon: '⚡',
};

function ownsElectricSkin() {
  return typeof Skins !== 'undefined' && Skins.owns(ELECTRIC_SKIN_ID);
}

function canStartElectricRaid() {
  return !ownsElectricSkin();
}

function createElectricRaidSong() {
  return {
    id: 'electric-raid',
    name: ELECTRIC_RAID.name,
    bpm: 128,
    duration: 3600,
    color: ELECTRIC_RAID.color,
    bassFreq: 55,
    melodyScale: [0, 4, 7, 11],
    electricRaid: true,
  };
}
