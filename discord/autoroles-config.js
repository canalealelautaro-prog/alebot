export const ROLES = [
  { id: 'ghoul', label: 'Ghoul', emoji: '🩸', color: 0x8b0000, group: 'raza' },
  { id: 'humano', label: 'Humano', emoji: '🧑', color: 0xcccccc, group: 'raza' },
  { id: 'semighoul', label: 'Mitad Ghoul', emoji: '👁️', color: 0xff3333, group: 'raza' },
  { id: 'anteiku', label: 'Anteiku', emoji: '☕', color: 0x3b7a57, group: 'faccion' },
  { id: 'aogiri', label: 'Aogiri Tree', emoji: '🌳', color: 0x222222, group: 'faccion' },
  { id: 'ccg', label: 'CCG', emoji: '⚔️', color: 0x2f4f8f, group: 'faccion' },
  { id: 'kagune', label: 'Kagune', emoji: '🦋', color: 0x9b30ff, group: 'extra' },
];
export const GROUPS = {
  raza: { title: 'Elige tu naturaleza', exclusive: true },
  faccion: { title: 'Elige tu facción', exclusive: true },
  extra: { title: 'Extras', exclusive: false },
};
