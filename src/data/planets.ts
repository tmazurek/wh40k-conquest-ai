import { Planet } from '../engine/types';

export const DEFAULT_PLANETS: Planet[] = [
  { id: 'planet-0', name: 'Elouith', index: 0, materials: 1, cards: 1, symbols: ['Tech'], isFirstPlanet: true, conquestCardId: '01166' },
  { id: 'planet-1', name: 'Iridial', index: 1, materials: 0, cards: 2, symbols: ['Strongpoint', 'Tech'], isFirstPlanet: false, conquestCardId: '01167' },
  { id: 'planet-2', name: 'Osus IV', index: 2, materials: 2, cards: 0, symbols: ['Material'], isFirstPlanet: false, conquestCardId: '01168' },
  { id: 'planet-3', name: 'Carnath', index: 3, materials: 1, cards: 1, symbols: ['Tech', 'Material'], isFirstPlanet: false, conquestCardId: '01169' },
  { id: 'planet-4', name: 'Tarrus', index: 4, materials: 2, cards: 1, symbols: ['Strongpoint'], isFirstPlanet: false, conquestCardId: '01170' },
  { id: 'planet-5', name: 'Barlus', index: 5, materials: 1, cards: 1, symbols: ['Material', 'Strongpoint'], isFirstPlanet: false, conquestCardId: '01171' },
  { id: 'planet-6', name: "Y'varn", index: 6, materials: 0, cards: 1, symbols: ['Tech', 'Material', 'Strongpoint'], isFirstPlanet: false, conquestCardId: '01172' },
];
