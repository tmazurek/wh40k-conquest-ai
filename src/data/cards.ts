import { CardDefinition } from '../engine/types';

import { SPACE_MARINE_CARDS } from './factions/spaceMarines';
import { ORK_CARDS } from './factions/orks';
import { ASTRA_MILITARUM_CARDS } from './factions/astraMilitarum';
import { CHAOS_CARDS } from './factions/chaos';
import { DARK_ELDAR_CARDS } from './factions/darkEldar';
import { ELDAR_CARDS } from './factions/eldar';
import { TAU_CARDS } from './factions/tau';
import { NECRON_CARDS } from './factions/necron';
import { TYRANID_CARDS } from './factions/tyranid';
import { NEUTRAL_CARDS } from './factions/neutral';

export const CARD_DB: Record<string, CardDefinition> = {
  ...SPACE_MARINE_CARDS,
  ...ORK_CARDS,
  ...ASTRA_MILITARUM_CARDS,
  ...CHAOS_CARDS,
  ...DARK_ELDAR_CARDS,
  ...ELDAR_CARDS,
  ...TAU_CARDS,
  ...NECRON_CARDS,
  ...TYRANID_CARDS,
  ...NEUTRAL_CARDS,
};

export const DECK_SM = [
  // Signature Squad (8 cards)
  'sm-stronghold',
  'sm-tempestblade',
  'sm-fury', 'sm-fury',
  'sm-chosen', 'sm-chosen', 'sm-chosen', 'sm-chosen',

  // Army (22 cards)
  'sm-10thscout', 'sm-landspeedervengeance',
  'sm-cardinis', 'sm-cardinis', 'sm-salamanderflamersquad',
  'sm-librarian', 'sm-librarian', 'sm-librarian',
  'sm-bloodangels', 'sm-bloodangels',
  'sm-dreadnought', 'sm-dreadnought',
  'sm-maxos',
  'sm-eagerrecruit', 'sm-eagerrecruit', 'sm-eagerrecruit',
  'tau-firewarrior', 'tau-firewarrior', 'tau-firewarrior',
  'tau-technician', 'tau-technician', 'tau-technician',

  // Support (2 cards)
  'sm-fortress', 'sm-fortress',

  // Attachment (8 cards)
  'sm-ironhalo',
  'sm-godwyn', 'sm-godwyn',
  'neutral-promotion', 'neutral-promotion',
  'tau-ionrifle', 'tau-ionrifle', 'tau-ionrifle',

  // Event (10 cards)
  'sm-droppod', 'sm-droppod', 'sm-droppod',
  'sm-indomitable', 'sm-indomitable',
  'sm-exterminatus',
  'neutral-nomercy', 'neutral-nomercy',
  'neutral-fallback', 'neutral-fallback'
];

export const DECK_ORK = [
  // Signature Squad (8 cards)
  'ork-cybork',
  'ork-kraktoof',
  'ork-bigga', 'ork-bigga',
  'ork-flashgitz', 'ork-flashgitz', 'ork-flashgitz', 'ork-flashgitz',
  
  // Army (20/21 cards as per counts)
  'ork-goffnob', 'ork-goffnob',
  'ork-weirdboy', 'ork-weirdboy',
  'ork-enraged', 'ork-enraged', 'ork-enraged',
  'ork-crushface',
  'ork-baddok',
  'ork-goffboyz', 'ork-goffboyz', 'ork-goffboyz',
  'ork-shootamob', 'ork-shootamob', 'ork-shootamob',
  'ork-burnaboyz', 'ork-burnaboyz', 'ork-burnaboyz',
  'neutral-elysian', 'neutral-elysian', 'neutral-elysian',
  
  // Support (4 cards)
  'ork-kannon', 'ork-kannon', 'ork-kannon',
  'ork-tellyporta',
  
  // Attachment (7 cards)
  'ork-rokkit', 'ork-rokkit',
  'astra-hostilegear', 'astra-hostilegear',
  'neutral-promotion', 'neutral-promotion', 'neutral-promotion',
  
  // Event (10 cards)
  'ork-battlecry', 'ork-battlecry', 'ork-battlecry',
  'ork-snotling', 'ork-snotling', 'ork-snotling',
  'ork-squigbomb',
  'astra-suppressive', 'astra-suppressive', 'astra-suppressive'
];
