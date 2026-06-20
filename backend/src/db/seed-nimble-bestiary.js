#!/usr/bin/env node
// Nimble RPG Bestiary seed for ragnarok1414
// Run from project root: node backend/src/db/seed-nimble-bestiary.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const db = require('./index')

const USER_ID     = '0621b230-8244-4d0a-bf1d-ede3d6b0f792'
const GAME_SYSTEM = 'nimble'

// ─── ENTRY MONSTERS ──────────────────────────────────────────────────────────

const ENTRY = [

  // ══════════ KOBOLDS ══════════════════════════════════════════════════════
  { name:'Kobold Minion', challenge:'1/4', tags:'kobold,small,minion', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Small',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1/4', hp:null, armor:'none', savedc:9, damagePerRound:'1d4',
    attacks:[{ name:'Stab', damage:'1d4', note:'Follows minion rules.' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:'Minion — any damage kills this creature.',
    sampleEncounters:'Level 1: 3 Kobold Flunkies / 4 Minions', loot:'Honey, lots of twine, sandwiches (stolen), shiny objects, dragon painting (poorly–yet lovingly–made), rotting meats, a variety of traps (small cages, spikes, snapping).',
  }},

  { name:'Kobold', challenge:'1/3', tags:'kobold,small', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Small',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1/3', hp:12, armor:'none', savedc:9, damagePerRound:'1d4+2',
    attacks:[{ name:'Stab', damage:'1d4+2 (or Sling, Range 8)', note:'' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'Level 1: 3 Kobold Flunkies/4 Minions\nLevel 2: 6 Kobolds*/4 Sneaks/1 Clanger+1 Trapper\nLevel 3: 2 Clangers+1 Trapper / 3 Trappers / 6 Sneaks*\nLevel 4: 4 Trappers / 2 Denwardens+4 Sneaks*',
    loot:'Honey, lots of twine, sandwiches (stolen), shiny objects, dragon painting (poorly–yet lovingly–made), rotting meats, a variety of traps (small cages, spikes, snapping).',
  }},

  { name:'Kobold Sneak', challenge:'1/2', tags:'kobold,small', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Small',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1/2', hp:15, armor:'none', savedc:10, damagePerRound:'1d4+2',
    attacks:[{ name:'Stab', damage:'1d4+2 (or Sling, Range 8)', note:'' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:"Revenge! When an ally dies, you may move up to 6 spaces before using your Noooo! ability.",
    sampleEncounters:'', loot:'Honey, lots of twine, sandwiches (stolen), shiny objects.',
  }},

  { name:'Kobold Clanger', challenge:'1', tags:'kobold', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Medium',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1', hp:16, armor:'heavy', savedc:10, damagePerRound:'1d4+2',
    attacks:[{ name:'Stab', damage:'1d4+2 (or Sling, Range 8)', note:'' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:"CLANG! Allies who hear your clanging roll 1 additional die whenever they attack.",
    sampleEncounters:'', loot:'Honey, lots of twine, sandwiches (stolen), shiny objects.',
  }},

  { name:'Kobold Trapper', challenge:'1', tags:'kobold,small', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Small',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1', hp:26, armor:'none', savedc:10, damagePerRound:'1d4+2',
    attacks:[{ name:'Throw Scorpion (2×)', damage:'(Range 8) 1d4+2', note:'' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:"Trap! When an enemy moves adjacent to you or an ally, they trigger one of your traps (1/encounter each).\n• BEEES! Deal 5d4 damage (doesn't miss). Half as much to ALL adjacent creatures.\n• HIDDEN NET! Restrained (escape DC 10).",
    sampleEncounters:'', loot:'Honey, lots of twine, sandwiches (stolen), shiny objects, a variety of traps.',
  }},

  { name:'Kobold Denwarden', challenge:'1', tags:'kobold', stat_data:{
    monsterTier:'entry', category:'Kobolds', size:'Medium',
    description:'Small, maniacal dragonlings. Fiercely protective of their own.',
    level:'1', hp:20, armor:'medium', savedc:10, damagePerRound:'1d4+2',
    attacks:[{ name:'Stab (2×)', damage:'1d4+2 (or Sling, Range 8)', note:'' }],
    familyTrait:"Noooo! When an ally within 2 spaces dies, attack once for free.",
    flavorAbilities:[], customAbility:"Hold! Adjacent allies gain Medium Armor.",
    sampleEncounters:'', loot:'Honey, lots of twine, sandwiches (stolen), shiny objects.',
  }},

  // ══════════ GOBLINS ═══════════════════════════════════════════════════════
  { name:'Goblin Minion', challenge:'1/4', tags:'goblin,small,minion', stat_data:{
    monsterTier:'entry', category:'Goblins', size:'Small',
    description:'Green, cunning, & thriving on the edge of chaos. Will mock you mercilessly if given the chance.',
    level:'1/4', hp:null, armor:'none', savedc:9, damagePerRound:'1d6',
    attacks:[{ name:'Stab', damage:'1d6', note:'Follows minion rules.' }],
    familyTrait:'Haha, Missed Me! Whenever an attack misses you, deal 1 psychic damage in return.',
    flavorAbilities:[], customAbility:'Minion — any damage kills this creature.',
    sampleEncounters:'Level 1: 1 Flunky / 2 Minions', loot:'Live mouse, moldy bread, smooth stones, sharp sticks, teeth (forcibly removed), arrows (surprisingly well-made), lots of blades (jagged, but effective), dead captive (forgot to feed him).',
  }},

  { name:'Goblin', challenge:'1/3', tags:'goblin,small', stat_data:{
    monsterTier:'entry', category:'Goblins', size:'Small',
    description:'Green, cunning, & thriving on the edge of chaos. Will mock you mercilessly if given the chance.',
    level:'1/3', hp:15, armor:'none', savedc:9, damagePerRound:'1d6+2',
    attacks:[{ name:'Stab', damage:'1d6+2 (or Shoot, Range 8)', note:'' }],
    familyTrait:'Haha, Missed Me! Whenever an attack misses you, deal 1 psychic damage in return.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'Level 1: 1 Flunky/2 Minions\nLevel 2: 3 Goblins/1 Bugbear/1 Taskmaster/1 Ratrider\nLevel 3: 1 Goblin+1 Bugbear/Taskmaster/Ratrider\nLevel 4: 2 Goblins+1 Bugbear/Taskmaster/Ratrider\nLevel 5: 3 Goblins+2 Ratrider/2 Bugbears*\nLevel 6: 3 Bugbears, 3 Ratriders, or 9 Goblins*',
    loot:'Live mouse, moldy bread, smooth stones, sharp sticks, teeth, arrows, lots of blades, dead captive, shiny junk.',
  }},

  { name:'Bugbear', challenge:'2', tags:'goblin,bugbear', stat_data:{
    monsterTier:'entry', category:'Goblins', size:'Medium',
    description:'Green, cunning, & thriving on the edge of chaos. Big, strong, and brutal.',
    level:'2', hp:30, armor:'medium', savedc:11, damagePerRound:'2d6+4',
    attacks:[
      { name:'Cleave', damage:'2d6+4', note:'' },
      { name:'Javelin', damage:'1d6+2 (Range 8)', note:'' },
    ],
    familyTrait:'Haha, Missed Me! Whenever an attack misses you, deal 1 psychic damage in return.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Lots of blades, dead captive, shiny junk.',
  }},

  { name:'Goblin Taskmaster', challenge:'2', tags:'goblin,small', stat_data:{
    monsterTier:'entry', category:'Goblins', size:'Small',
    description:'Green, cunning, & thriving on the edge of chaos. Cunning commander who hides behind minions.',
    level:'2', hp:30, armor:'medium', savedc:11, damagePerRound:'1d6+2',
    attacks:[
      { name:'Stab', damage:'1d6+2 (or Shoot, Range 8)', note:'Then: Get in here! Call a goblin minion to the fight.' },
    ],
    familyTrait:'Haha, Missed Me! Whenever an attack misses you, deal 1 psychic damage in return.',
    flavorAbilities:[], customAbility:'Meat Shield. Can force other goblins to Interpose for him.',
    sampleEncounters:'', loot:'Live mouse, moldy bread, smooth stones, sharp sticks.',
  }},

  { name:'Goblin Ratrider', challenge:'2', tags:'goblin,mounted', stat_data:{
    monsterTier:'entry', category:'Goblins', size:'Medium',
    description:'Green, cunning, & thriving on the edge of chaos. Rides a giant rat at terrifying speed.',
    level:'2', hp:30, armor:'none', savedc:11, damagePerRound:'1d6+2',
    speed:10,
    attacks:[{ name:'Bite & Stab (2×)', damage:'1d6+2', note:'On crit: Prone.' }],
    familyTrait:'Haha, Missed Me! Whenever an attack misses you, deal 1 psychic damage in return.',
    flavorAbilities:[], customAbility:'CHAAARGE! If you move at least 4 spaces in a straight line, attack with advantage once.',
    sampleEncounters:'', loot:'Live mouse, moldy bread, smooth stones.',
  }},

  // ══════════ SNAKEMEN ══════════════════════════════════════════════════════
  { name:'Snakeman Minion', challenge:'1/4', tags:'snakeman,minion', stat_data:{
    monsterTier:'entry', category:'Snakemen', size:'Medium',
    description:'*Aggressive Hissing Noises*',
    level:'1/4', hp:null, armor:'none', savedc:9, damagePerRound:'1d6',
    attacks:[{ name:'Strike', damage:'1d6 melee/ranged', note:'Follows minion rules.' }],
    familyTrait:'Coiling Strike. On melee crit: Grapple (escape DC 10).',
    flavorAbilities:[], customAbility:'Minion — any damage kills this creature.',
    sampleEncounters:'', loot:'Shed scales, venom sacs, forked daggers, crude jewelry.',
  }},

  { name:'Snakeman', challenge:'1', tags:'snakeman', stat_data:{
    monsterTier:'entry', category:'Snakemen', size:'Medium',
    description:'*Aggressive Hissing Noises*',
    level:'1', hp:26, armor:'none', savedc:10, damagePerRound:'1d6+6',
    attacks:[{ name:'Slash', damage:'1d6+6 (or Spit, Range 8)', note:'' }],
    familyTrait:'Coiling Strike. On melee crit: Grapple (escape DC 10).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Shed scales, venom sacs, forked daggers, crude jewelry.',
  }},

  { name:'Cobra Captain', challenge:'4', tags:'snakeman', stat_data:{
    monsterTier:'entry', category:'Snakemen', size:'Medium',
    description:'*Aggressive Hissing Noises* — deadly commander of snakeman warbands.',
    level:'4', hp:36, armor:'medium', savedc:12, damagePerRound:'1d6+6',
    attacks:[{ name:'Slash (2×)', damage:'1d6+6 (or Spit, Range 8)', note:'' }],
    familyTrait:'Coiling Strike. On melee crit: Grapple (escape DC 10).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Shed scales, venom sacs, forked daggers, crude jewelry.',
  }},

  { name:'Giant Cobra', challenge:'8', tags:'snakeman,large', stat_data:{
    monsterTier:'entry', category:'Snakemen', size:'Large',
    description:'*Aggressive Hissing Noises* — a titanic serpent, suffocating and venomous.',
    level:'8', hp:80, armor:'medium', savedc:14, damagePerRound:'2d6+20',
    attacks:[{ name:'Crush', damage:'2d6+20', note:'Advantage vs. smaller creatures.' }],
    familyTrait:'Coiling Strike. On melee crit: Grapple (escape DC 10).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Venom sacs, shed scales, crushed treasure from victims.',
  }},

  // ══════════ BANDITS ═══════════════════════════════════════════════════════
  { name:'Bandit Minion', challenge:'1/4', tags:'bandit,human,minion', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over)",
    level:'1/4', hp:null, armor:'none', savedc:9, damagePerRound:'1d8',
    attacks:[{ name:'Stab', damage:'1d8', note:'Follows minion rules.' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'Minion — any damage kills this creature.',
    sampleEncounters:'', loot:'VERY valuable stolen item (its owner may come looking), kidnapped person, leather armor, chipped blades, old food, fine art or clothes, coded letter from a secretive client.',
  }},

  { name:'Bandit', challenge:'1/3', tags:'bandit,human', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over)",
    level:'1/3', hp:12, armor:'none', savedc:9, damagePerRound:'1d8+1',
    attacks:[{ name:'Stab', damage:'1d8+1 (or Shoot, Range 8)', note:'' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'VERY valuable stolen item, leather armor, chipped blades, coded letter.',
  }},

  { name:'Bandit Bruiser', challenge:'2', tags:'bandit,human', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over) — brute enforcer.",
    level:'2', hp:24, armor:'medium', savedc:11, damagePerRound:'2d8+4',
    attacks:[{ name:'Bash', damage:'2d8+4', note:'' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'VERY valuable stolen item, leather armor, chipped blades.',
  }},

  { name:'Bandit Captain', challenge:'4', tags:'bandit,human', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over) — ruthless leader.",
    level:'4', hp:36, armor:'medium', savedc:12, damagePerRound:'1d8+1',
    attacks:[{ name:'Slice (3×)', damage:'1d8+1 (or Shoot, Range 8)', note:'' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'VERY valuable stolen item, fine leather armor, coded letter from a secretive client, wagons of goods.',
  }},

  { name:'Bandit Hunter', challenge:'1', tags:'bandit,human,ranged', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over) — precision archer.",
    level:'1', hp:22, armor:'none', savedc:10, damagePerRound:'2d8+2',
    attacks:[{ name:'Battlebow', damage:'2d8+2 (Range 12)', note:'' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Fine bow, arrows, leather armor, stolen valuables.',
  }},

  { name:'Bandit Assassin', challenge:'2', tags:'bandit,human,stealth', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over) — silent killer.",
    level:'2', hp:24, armor:'none', savedc:11, damagePerRound:'1d8+2',
    attacks:[{ name:'Poison Blade (2×)', damage:'1d8+2', note:'On damage: Dazed.' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'Sneak. You are invisible until you attack.',
    sampleEncounters:'', loot:'Poison vials, fine blades, dark clothing, stolen goods.',
  }},

  { name:'Bandit Mage', challenge:'4', tags:'bandit,human,mage', stat_data:{
    monsterTier:'entry', category:'Bandits', size:'Medium',
    description:"You've got money, they want money… a perfect match! (hand it over) — rogue spellcaster.",
    level:'4', hp:41, armor:'none', savedc:12, damagePerRound:'3d8',
    attacks:[{ name:'Arc Lightning', damage:'3d8 (Range 12)', note:'Also strikes the next closest creature. On miss: damage self instead.' }],
    familyTrait:'Parry. Treat attacks against you that roll 2 as a miss.',
    flavorAbilities:[], customAbility:'Spark Step. When damaged, teleport up to 4 spaces.',
    sampleEncounters:'', loot:'Spell components, stolen gold, coded letters, arcane focus.',
  }},

  // ══════════ STIRGES (Dungeon Denizens) ════════════════════════════════════
  { name:'Stirge', challenge:'1/2', tags:'stirge,tiny,dungeon', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Tiny',
    description:'For some creatures, YOU are the loot at the end of the dungeon.',
    level:'1/2', hp:10, armor:'none', savedc:10, damagePerRound:'1d4+2',
    attacks:[{ name:'Latch On', damage:'1d4+2', note:'On hit: Latched On.' }],
    familyTrait:'Evasive Flier. Attacks against stirges are made with disadvantage.',
    flavorAbilities:[], customAbility:"Latched On. You move where your target moves until either dies. Your attacks can't miss or be Defended/Interposed against. Attacks that miss you damage your target instead.",
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), ancient bones, indigestible items (bones, gems, magical trinkets).',
  }},

  { name:'Greater Stirge', challenge:'6', tags:'stirge,small,dungeon', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Small',
    description:'For some creatures, YOU are the loot at the end of the dungeon. A massive blood-drinking terror.',
    level:'6', hp:60, armor:'none', savedc:13, damagePerRound:'1d12+10',
    attacks:[{ name:'Latch On', damage:'1d12+10', note:'On hit: Latched On.' }],
    familyTrait:'Evasive Flier. Attacks against stirges are made with disadvantage.',
    flavorAbilities:[], customAbility:"Latched On. You move where your target moves until either dies. Your attacks can't miss or be Defended/Interposed against. Attacks that miss you damage your target instead.",
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), ancient bones, indigestible items.',
  }},

  // ══════════ MIMICS (Dungeon Denizens) ═════════════════════════════════════
  { name:'Tiny Mimic', challenge:'1', tags:'mimic,dungeon,shapeshifter', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Medium',
    description:'Ambusher. Mimics always start first and heroes roll Initiative with disadvantage. Forms: Cup, Shoe, Apple, Candlestick, Potion, Pebble.',
    level:'1', hp:28, armor:'none', savedc:10, damagePerRound:'1d4',
    attacks:[
      { name:'Pseudopod', damage:'1d4', note:'Escape DC 9, or creature is Grappled.' },
      { name:'Bite', damage:'1d12', note:'Target must be Grappled.' },
    ],
    familyTrait:"Ambusher. Mimics always start first and heroes roll Initiative with disadvantage.\nSticky. Mimic hits also Grapple and can Grapple any number of creatures. When crit, release 1 creature (attacker's choice).",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'A leather-bound journal (water-damaged pages), lockpicks, a treasure map (only half), boots (suspiciously untouched by corrosion).',
  }},

  { name:'Small Mimic', challenge:'2', tags:'mimic,dungeon,shapeshifter', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Medium',
    description:'Ambusher. Forms: Backpack, Shield/Weapon, Chair, Crate, Tree Stump.',
    level:'2', hp:41, armor:'none', savedc:11, damagePerRound:'1d6',
    attacks:[
      { name:'Pseudopod', damage:'1d6', note:'Escape DC 11, or creature is Grappled.' },
      { name:'Bite', damage:'1d20', note:'Target must be Grappled.' },
    ],
    familyTrait:"Ambusher. Mimics always start first and heroes roll Initiative with disadvantage.\nSticky. Mimic hits also Grapple and can Grapple any number of creatures. When crit, release 1 creature (attacker's choice).",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'A leather-bound journal (water-damaged pages), lockpicks, a treasure map (only half), boots.',
  }},

  { name:'Medium Mimic', challenge:'3', tags:'mimic,dungeon,shapeshifter', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Medium',
    description:'Ambusher. Forms: Table, Treasure Chest, Barrel, Bookshelf, Door, Bed. *(HP is approximate — verify against book)*',
    level:'3', hp:55, armor:'none', savedc:11, damagePerRound:'1d8',
    attacks:[
      { name:'Pseudopod', damage:'1d8', note:'Escape DC 13, or creature is Grappled.' },
      { name:'Bite', damage:'2d20', note:'Target must be Grappled.' },
    ],
    familyTrait:"Ambusher. Mimics always start first and heroes roll Initiative with disadvantage.\nSticky. Mimic hits also Grapple and can Grapple any number of creatures. When crit, release 1 creature (attacker's choice).",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'A leather-bound journal (water-damaged pages), lockpicks, a treasure map (only half).',
  }},

  // ══════════ OOZES (Dungeon Denizens) ══════════════════════════════════════
  { name:'Gray Ooze', challenge:'1', tags:'ooze,dungeon', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Medium',
    description:'For some creatures, YOU are the loot at the end of the dungeon.',
    level:'1', hp:28, armor:'none', savedc:10, damagePerRound:'1d6+2',
    attacks:[{ name:'Acidic Touch (2×)', damage:'1d6+2', note:'' }],
    familyTrait:"Digestive Touch. Contact with an ooze inflicts the Digested condition: they deal an additional X damage for each time the target has been Digested this encounter.\nGoopy. When crit or dealt any slashing damage: summon X ooze minions (size: d6); their attacks inflict Digested.",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), ancient bones with traces of gnaw marks, indigestible items (bones, gems, magical trinkets), a leather-bound journal (water-damaged pages).',
  }},

  { name:'Ochre Jelly', challenge:'4', tags:'ooze,dungeon,large', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Large',
    description:'For some creatures, YOU are the loot at the end of the dungeon. A sluggish but relentless hunter.',
    level:'4', hp:52, armor:'none', savedc:12, damagePerRound:'1d6+3',
    attacks:[{ name:'Acidic Touch (2×)', damage:'1d6+3', note:'' }],
    familyTrait:"Digestive Touch. Contact with an ooze inflicts the Digested condition: they deal an additional X damage for each time the target has been Digested this encounter.\nGoopy. When crit or dealt any slashing damage: summon X ooze minions (size: d6); their attacks inflict Digested.",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), indigestible items (bones, gems, magical trinkets).',
  }},

  { name:'Black Pudding', challenge:'8', tags:'ooze,dungeon,large', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Large',
    description:'For some creatures, YOU are the loot at the end of the dungeon. Acidic and nearly indestructible.',
    level:'8', hp:90, armor:'none', savedc:14, damagePerRound:'2d6+5',
    attacks:[{ name:'Acidic Touch', damage:'(Reach 2) 2d6+5', note:'' }],
    familyTrait:"Digestive Touch. Contact with an ooze inflicts the Digested condition: they deal an additional X damage for each time the target has been Digested this encounter.\nGoopy. When crit or dealt any slashing damage: summon X ooze minions (size: d6); their attacks inflict Digested.",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), ancient bones, indigestible magical trinkets.',
  }},

  { name:'Elder Ooze', challenge:'12', tags:'ooze,dungeon,huge', stat_data:{
    monsterTier:'entry', category:'Dungeon Denizens', size:'Huge',
    description:'For some creatures, YOU are the loot at the end of the dungeon. An ancient, vast puddle of dissolution.',
    level:'12', hp:150, armor:'none', savedc:16, damagePerRound:'1d6+6',
    attacks:[{ name:'Acidic Touch (3×)', damage:'(Reach 3) 1d6+6', note:'' }],
    familyTrait:"Digestive Touch. Contact with an ooze inflicts the Digested condition: they deal an additional X damage for each time the target has been Digested this encounter.\nGoopy. When crit or dealt any slashing damage: summon X ooze minions (size: d6); their attacks inflict Digested.",
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished coins (partially dissolved by acid), ancient bones, indigestible magical trinkets, rusted tools.',
  }},

  // ══════════ GNOLLS (Hill & Field) ═════════════════════════════════════════
  { name:'Gnoll', challenge:'1', tags:'gnoll,hill-field', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Medium',
    description:'Mighty brutes and cunning beasts, always on the lookout for easy prey.',
    level:'1', hp:28, armor:'none', savedc:10, damagePerRound:'1d10',
    attacks:[
      { name:'Ravage (2×)', damage:'1d10', note:'' },
      { name:'Shoot', damage:'(Range 12) 1d10', note:'' },
    ],
    familyTrait:'Frenzy. Advantage against Bloodied creatures.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Crude weapons, gnawed bones, hides, trophy teeth.',
  }},

  { name:'Gnoll Packleader', challenge:'4', tags:'gnoll,hill-field', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Medium',
    description:'Mighty brutes and cunning beasts. The dominant gnoll who drives the pack to kill.',
    level:'4', hp:39, armor:'medium', savedc:12, damagePerRound:'1d10',
    attacks:[{ name:'Ravage (3×)', damage:'1d10', note:'' }],
    familyTrait:'Frenzy. Advantage against Bloodied creatures.',
    flavorAbilities:[], customAbility:'Bark Orders. 2 allies can move. Then: Ravage (3×).',
    sampleEncounters:'', loot:'Crude weapons, gnawed bones, hides, trophy teeth, pack standard.',
  }},

  // ══════════ WORG (Hill & Field) ═══════════════════════════════════════════
  { name:'Worg', challenge:'1', tags:'worg,large,hill-field', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Large',
    description:'Mighty brutes and cunning beasts. A massive predatory wolf with a taste for heroes.',
    level:'1', hp:28, armor:'none', savedc:10, damagePerRound:'1d6+2',
    speed:10,
    attacks:[{ name:'Rip Apart (2×)', damage:'1d6+2', note:'On hit: Grappled (escape DC 10).' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Savage. Always crits when attacking a Grappled creature.',
    sampleEncounters:'', loot:'Heavy fur pelt, claws, fangs.',
  }},

  // ══════════ BULETTE (Hill & Field) ════════════════════════════════════════
  { name:'Bulette', challenge:'10', tags:'bulette,large,hill-field,burrow', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Large',
    description:'Mighty brutes and cunning beasts. The land shark — it burrows up from beneath.',
    level:'10', hp:74, armor:'heavy', savedc:15, damagePerRound:'1d12+20',
    burrowSpeed:6,
    attacks:[
      { name:'Drag Below', damage:'2d12', note:'Target must be Grappled. Then drag below and burrow away.' },
      { name:'Leap & Bite', damage:'1d12+20', note:'Leap 6 spaces. On hit: Grappled. (Only if not grappling.)' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:"Burst Forth! Combat with a Bulette starts with the heaviest character making a DC 14 DEX save or take 1d12+20 damage (half on save).",
    sampleEncounters:'', loot:'Thick hide plates, fangs, claws.',
  }},

  // ══════════ HILL GIANT (Hill & Field) ═════════════════════════════════════
  { name:'Hill Giant', challenge:'12', tags:'giant,huge,hill-field', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Huge',
    description:'Mighty brutes and cunning beasts. Dim-witted but immensely powerful.',
    level:'12', hp:140, armor:'none', savedc:16, damagePerRound:'1d6+15',
    speed:8,
    attacks:[
      { name:'Smash (2×)', damage:'(Reach 2) 1d6+15', note:'' },
      { name:'Boulder!', damage:'(Range 12) 1d6+20', note:'' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Brute. On hit: Knockback Primary Die spaces.',
    sampleEncounters:'', loot:'Massive club, stolen livestock, crude treasures (a house door used as a brooch, etc.).',
  }},

  // ══════════ TROLL (Hill & Field) ══════════════════════════════════════════
  { name:'Troll', challenge:'10', tags:'troll,large,hill-field', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Large',
    description:'Mighty brutes and cunning beasts. Regenerates endlessly — only fire, radiant, or a crit at 0 HP can end it.',
    level:'10', hp:100, armor:'medium', savedc:15, damagePerRound:'1d4+10',
    speed:8,
    attacks:[
      { name:'Claws', damage:'(Reach 2) 1d4+10', note:'On crit: Prone.' },
      { name:'Bite', damage:'1d4+20', note:'Target must be Prone.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Regenerate. Does not die at 0 HP. Only fire, radiant, or a crit while at 0 HP can kill it.\nChoose twice each turn.',
    sampleEncounters:'', loot:'Troll hide (valuable alchemical ingredient), bones of past victims, crude trinkets.',
  }},

  // ══════════ BLUE DRAKE (Hill & Field) ═════════════════════════════════════
  { name:'Blue Drake', challenge:'2', tags:'drake,hill-field,fly', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Medium',
    description:'Mighty brutes and cunning beasts. A crackling lightning lizard with a deadly death surge.',
    level:'2', hp:34, armor:'none', savedc:11, damagePerRound:'1d12+5',
    flySpeed:12,
    attacks:[{ name:'Shocking Bite', damage:'1d12+5', note:'Ignores metal armor.' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:'On Death. Deal 1d12 damage back (ignores metal armor).',
    sampleEncounters:'', loot:'Lightning-scarred scales, electric glands (valuable), fangs.',
  }},

  // ══════════ GRIFFON (Hill & Field) ════════════════════════════════════════
  { name:'Griffon', challenge:'4', tags:'griffon,large,hill-field,fly', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Large',
    description:'Mighty brutes and cunning beasts. Majestic and ruthless aerial predator.',
    level:'4', hp:50, armor:'none', savedc:12, damagePerRound:'2d6+10',
    flySpeed:12,
    attacks:[
      { name:'Talons', damage:'2d6+10', note:'On hit: Grappled (escape DC 14).' },
      { name:'Fly & Drop', damage:'6d6 fall damage', note:'If grappling: fly upward 12 and release.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Griffon feathers (very valuable), talons, beak.',
  }},

  // ══════════ ROC (Hill & Field) ════════════════════════════════════════════
  { name:'Roc', challenge:'17', tags:'roc,gargantuan,hill-field,fly', stat_data:{
    monsterTier:'entry', category:'Hill & Field', size:'Gargantuan',
    description:'Mighty brutes and cunning beasts. A continent-shadowing apex predator of the skies.',
    level:'17', hp:195, armor:'medium', savedc:18, damagePerRound:'3d12+20',
    flySpeed:20,
    attacks:[
      { name:'Pluck Up', damage:'(Reach 4) 3d12+20', note:'Up to 2 creatures. On hit: Grappled (escape DC 18).' },
      { name:'Crush & Drop', damage:'20 + 10d6 fall', note:'Fly upward 20 spaces, deal 20 damage to Grappled creatures, then release.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Enormous feathers (each worth a small fortune), talons the size of swords, nest filled with treasure from dropped victims.',
  }},

  // ══════════ UNDEAD ═════════════════════════════════════════════════════════
  { name:'Skeleton', challenge:'1/3', tags:'undead,skeleton', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living.',
    level:'1/3', hp:10, armor:'none', savedc:9, damagePerRound:'1d4+3',
    attacks:[{ name:'Grave Arrow', damage:'1d4+3 (Range 8)', note:'' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished silver locket, bone fragments engraved with arcane symbols, a dark gemstone (emits a faint chill), vials of blood (long-dried), a diary written in an ancient hand.',
  }},

  { name:'Zombie', challenge:'1/2', tags:'undead,zombie', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living.',
    level:'1/2', hp:15, armor:'none', savedc:10, damagePerRound:'1d4+4',
    attacks:[{ name:'Crunch', damage:'1d4+4', note:'On damage: Grappled.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished silver locket, bone fragments, macabre necklace (skeletal finger bones).',
  }},

  { name:'Ghoul', challenge:'1', tags:'undead,ghoul', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living. Paralytic claws.',
    level:'1', hp:20, armor:'none', savedc:10, damagePerRound:'1d4+8',
    attacks:[{ name:'Sickening Claw', damage:'1d4+8', note:'On damage: Dazed.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished silver locket, bone fragments, vials of blood.',
  }},

  { name:'Specter', challenge:'3', tags:'undead,specter,fly', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living. A ghostly horror that drains life force.',
    level:'3', hp:30, armor:'none', savedc:11, damagePerRound:'1d4',
    flySpeed:6,
    attacks:[{ name:'Deathly Touch', damage:'1d4', note:'On damage: set HP to 0.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Broken holy symbol smeared with ash, a signet ring from a lost noble house, moldy grave dirt (whispers when touched).',
  }},

  { name:'Ogre Zombie', challenge:'5', tags:'undead,zombie,large', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Large',
    description:'Hate the living for not being dead, hate themselves for not being living. A massive shambling corpse.',
    level:'5', hp:46, armor:'none', savedc:12, damagePerRound:'1d4+8',
    attacks:[{ name:'Greatclub (2×)', damage:'1d4+8', note:'On crit: Prone.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Giant bones, crude treasures stuffed in rotting pouches.',
  }},

  { name:'Mummy', challenge:'6', tags:'undead,mummy', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living. An ancient, cursed guardian.',
    level:'6', hp:54, armor:'none', savedc:13, damagePerRound:'1d4+8',
    attacks:[{ name:'Slam (2×)', damage:'1d4+8', note:'On damage: Dazed.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished silver locket containing a faded portrait, bone fragments engraved with arcane symbols, a dark gemstone, vials of blood (long-dried), a diary in an ancient hand, a macabre necklace.',
  }},

  { name:'Giant Zombie', challenge:'8', tags:'undead,zombie,huge', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Huge',
    description:'Hate the living for not being dead, hate themselves for not being living. A colossal animated corpse.',
    level:'8', hp:73, armor:'none', savedc:14, damagePerRound:'1d4+10',
    attacks:[{ name:'Decaying Swipe (2×)', damage:'1d4+10', note:'On damage: knockback Primary Die spaces.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Enormous bones, treasures crushed underfoot, broken holy symbol.',
  }},

  { name:'Wraith', challenge:'10', tags:'undead,wraith,fly', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living. A life-draining shadow made flesh.',
    level:'10', hp:94, armor:'none', savedc:15, damagePerRound:'1d4+10',
    flySpeed:6,
    attacks:[{ name:'Soul Rend (2×)', damage:'(Range 8) 1d4+10', note:'On damage: deal 1 Wound.' }],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Tarnished silver locket, a signet ring from a lost noble house, broken holy symbol smeared with ash.',
  }},

  { name:'Mummy Lord', challenge:'21', tags:'undead,mummy,boss', stat_data:{
    monsterTier:'entry', category:'Undead', size:'Medium',
    description:'Hate the living for not being dead, hate themselves for not being living. An ancient lich-king wrapped in centuries of dark power.',
    level:'21', hp:280, armor:'none', savedc:20, damagePerRound:'1d4+20',
    attacks:[
      { name:'Slam (2×)', damage:'1d4+20', note:'On damage: Dazed.' },
      { name:'Scarab Swarm', damage:'', note:'Summon 10 Scarab minions (d6) within 6 spaces. Then use Slam (2×).' },
    ],
    familyTrait:'Unliving, Undying. The first time this dies, reset to 1 HP instead (excluding minions).',
    flavorAbilities:[], customAbility:'Cursed Gaze. When crit: DC 20 INT save, or suffer 1 Wound.',
    sampleEncounters:'', loot:'Tarnished silver locket containing a faded portrait, bone fragments with arcane symbols, a dark gemstone, vials of blood, a diary in an ancient hand, macabre necklace, broken holy symbol, shovel.',
  }},

  // ══════════ FOREST DENIZENS ════════════════════════════════════════════════
  { name:'Duskprowler', challenge:'6', tags:'forest,large,predator', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Large',
    description:'Every shadow hides a predator, every branch and leaf conspires against you, the forest is alive–and you are not welcome.',
    level:'6', hp:70, armor:'none', savedc:13, damagePerRound:'2d8+2',
    attacks:[{ name:'Ravage (2×)', damage:'2d8+2', note:'' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Illusory Aura. Attacks against the Duskprowler have Disadvantage 2. Damage suppresses this effect until the end of the next hero\'s turn.',
    sampleEncounters:'', loot:'25 ft. of vines (usable as rope), glowing sap (minor healing properties), moss-covered coins from an ancient era, a brittle leaf with veins that spell out words in Druidic, a pouch of dried herbs.',
  }},

  { name:'Druid', challenge:'8', tags:'forest,druid,shapeshifter', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Medium',
    description:'Every shadow hides a predator. A feral nature guardian who shifts form mid-battle.',
    level:'8', hp:90, armor:'none', savedc:14, damagePerRound:'4d4+10',
    attacks:[
      { name:'Beastshift', damage:'4d4+10', note:'+4 speed, gain Medium armor this round.' },
      { name:'Hurricane', damage:'4d4+10 to all enemies within Reach 3', note:'On damage: move targets anywhere else in Reach.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Rare herbs, a cluster of rare mushrooms, a small flower that never wilts, flute overgrown with moss, a tattered map to a hidden grove.',
  }},

  { name:'Basilisk', challenge:'7', tags:'forest,basilisk,petrify', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Medium',
    description:'Every shadow hides a predator. One glance turns flesh to stone.',
    level:'7', hp:48, armor:'heavy', savedc:13, damagePerRound:'1d8+10',
    attacks:[
      { name:'Stone Gaze', damage:'', note:'Daze 1 creature within sight. Then use Envenom.' },
      { name:'Envenom', damage:'1d8+10', note:'Advantage vs Dazed targets.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:"Flesh to Stone. Creatures Dazed by the Basilisk remain so for 10 minutes. Dazed 3 times = Petrified.",
    sampleEncounters:'', loot:'Stone-dust scales, venomous fangs (valuable alchemical ingredient), petrified remains of previous victims.',
  }},

  // ══════════ BRIARBANES (Forest Denizens) ══════════════════════════════════
  { name:'Seedling', challenge:'1/2', tags:'briarbane,small,forest,plant', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Small',
    description:'Soulless, thorny plant beings fertilized by blood.',
    level:'1/2', hp:8, armor:'heavy', savedc:10, damagePerRound:'2d6+2',
    attacks:[{ name:'Thorn Seed', damage:'(Range 6) 2d6+2', note:'' }],
    familyTrait:'Peeling Bark. Damage degrades Armor 1 step: Heavy → Medium → None.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'25 ft. of vines (usable as rope), glowing sap (minor healing properties), a cluster of rare mushrooms, a small flower that never wilts.',
  }},

  { name:'Acidpod', challenge:'1', tags:'briarbane,small,forest,plant', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Small',
    description:'Soulless, thorny plant beings fertilized by blood. Erupts in acid on death.',
    level:'1', hp:8, armor:'heavy', savedc:10, damagePerRound:'',
    attacks:[{ name:'Grab', damage:'', note:'DC 12 DEX save or Grappled.' }],
    familyTrait:'Peeling Bark. Damage degrades Armor 1 step: Heavy → Medium → None.',
    flavorAbilities:[], customAbility:"Caustic Eruption. On death: 4d6 acid damage to ALL adjacent creatures.",
    sampleEncounters:'', loot:'Acid sac (handle with extreme care), vines, glowing sap.',
  }},

  { name:'Tangler', challenge:'2', tags:'briarbane,forest,plant', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Medium',
    description:'Soulless, thorny plant beings fertilized by blood. Ensnares and drags victims in.',
    level:'2', hp:20, armor:'heavy', savedc:11, damagePerRound:'1d6+2',
    attacks:[{ name:'Tangle (2×)', damage:'(Reach 6) 1d6+2', note:'On hit: Grappled (escape DC 12, or any fire or slashing damage).' }],
    familyTrait:'Peeling Bark. Damage degrades Armor 1 step: Heavy → Medium → None.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'25 ft. of vines (usable as rope), glowing sap, a pouch of dried herbs.',
  }},

  { name:'Rootbreaker', challenge:'5', tags:'briarbane,large,forest,plant', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Large',
    description:'Soulless, thorny plant beings fertilized by blood. An animated plant creature created by botanical magic.',
    level:'5', hp:50, armor:'heavy', savedc:12, damagePerRound:'3d6+6',
    attacks:[{ name:'Slam', damage:'3d6+6', note:'On crit: knockback 2.' }],
    familyTrait:'Peeling Bark. Damage degrades Armor 1 step: Heavy → Medium → None.',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'25 ft. of vines (usable as rope), glowing sap, moss-covered coins.',
  }},

  { name:'Treant', challenge:'14', tags:'briarbane,huge,forest,plant', stat_data:{
    monsterTier:'entry', category:'Forest Denizens', size:'Huge',
    description:'Soulless, thorny plant beings fertilized by blood. An ancient, wrathful tree-titan.',
    level:'14', hp:170, armor:'heavy', savedc:17, damagePerRound:'2d6+10',
    attacks:[
      { name:'Slam', damage:'(Reach 3) 2d6+10', note:'On damage: Prone.' },
      { name:'Stomp', damage:'2d6+20', note:'Target must be Hampered.' },
    ],
    familyTrait:'Peeling Bark. Damage degrades Armor 1 step: Heavy → Medium → None.',
    flavorAbilities:[], customAbility:"Enrage. Attack with advantage when unarmored. Choose twice each turn.",
    sampleEncounters:'', loot:'Ancient hardwood (priceless to crafters), a flower crown, a dried flower crown, rare acorns.',
  }},

  // ══════════ CULTISTS (Cultists/Horrors) ═══════════════════════════════════
  { name:'Cultist', challenge:'1', tags:'cultist,horror,humanoid', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Medium',
    description:'Driven by twisted beliefs, fanatical cultists perform dark rituals to awaken ancient evils, unleashing horrors that feast on fear and despair.',
    level:'1', hp:28, armor:'none', savedc:10, damagePerRound:'1d6+6',
    attacks:[
      { name:'Dreadful Blade', damage:'1d6+6', note:'' },
      { name:'Blood Boil', damage:'(Range 12, Bloodied creature) 3d6+6', note:'' },
    ],
    familyTrait:"Fanatical Zeal. While not at max HP, make all rolls with advantage. Your crits also inflict Despair.\nDespair. Disadvantage on the next attack you make this encounter.",
    flavorAbilities:[], customAbility:"Oblation of Blood! If undamaged, attack self for 2 damage. Adjacent enemies are inflicted with Despair.",
    sampleEncounters:'', loot:'Bloodstained dagger (engraved with dark symbols), a twisted idol (whispers terrible thoughts), vial of black ichor, a mask (carved likeness of a fiend), a scroll with summoning rituals (half-finished), black candles (cannot be extinguished).',
  }},

  { name:'Fanatic', challenge:'3', tags:'cultist,horror,humanoid', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Medium',
    description:'Driven by twisted beliefs. A more powerful zealot who weaponizes madness.',
    level:'3', hp:41, armor:'none', savedc:11, damagePerRound:'3d6+6',
    attacks:[
      { name:'Whispers of Madness', damage:'3d6+6 psychic', note:'Contested STR check or Grapple (reroll to escape, or any radiant damage). Cannot be Defended or Interposed against.' },
    ],
    familyTrait:"Fanatical Zeal. While not at max HP, make all rolls with advantage. Your crits also inflict Despair.\nDespair. Disadvantage on the next attack you make this encounter.",
    flavorAbilities:[], customAbility:"Oblation of Blood! If undamaged, attack self for 2 damage. Adjacent enemies are inflicted with Despair.",
    sampleEncounters:'', loot:'Bloodstained dagger, twisted idol, vial of black ichor, tattered robe (lined with hidden pockets), shackles inscribed with infernal runes.',
  }},

  { name:'Doomsayer', challenge:'5', tags:'cultist,horror,humanoid', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Medium',
    description:'Driven by twisted beliefs. A chanting priest who nullifies damage and drives allies to frenzy.',
    level:'5', hp:58, armor:'none', savedc:12, damagePerRound:'2d6',
    attacks:[
      { name:'Ecstatic Ravings', damage:'2d6 psychic', note:'All enemies who can hear you.' },
    ],
    familyTrait:"Fanatical Zeal. While not at max HP, make all rolls with advantage. Your crits also inflict Despair.\nDespair. Disadvantage on the next attack you make this encounter.",
    flavorAbilities:[], customAbility:"Feverish Chant. (Concentration) Reduce all damage done to allies who can hear you to 1.",
    sampleEncounters:'', loot:'Bloodstained dagger, twisted idol, vial of black ichor, fragment of a fiendish contract, black candles (cannot be extinguished).',
  }},

  // ══════════ HORRORS (Cultists/Horrors) ════════════════════════════════════
  { name:'Stenchling', challenge:'1/2', tags:'horror,small,demon', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Small',
    description:'Driven by twisted beliefs — a minor demon summoned from the depths.',
    level:'1/2', hp:18, armor:'none', savedc:10, damagePerRound:'2d6',
    attacks:[{ name:'Bite', damage:'2d6', note:'' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:"Putrid Cloud. On Death: 2d6 poison damage to enemies within Reach 2.",
    sampleEncounters:'', loot:'Bloodstained dagger, vial of black ichor, a tattered robe.',
  }},

  { name:'Spiny Fiend', challenge:'4', tags:'horror,demon', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Medium',
    description:'Driven by twisted beliefs — a spined demon that punishes melee attackers.',
    level:'4', hp:49, armor:'none', savedc:12, damagePerRound:'1d6+6',
    attacks:[
      { name:'Claws (2×)', damage:'1d6+6', note:'' },
      { name:'Shoot Spine', damage:'(Range 12) 1d6+6', note:'' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Spines. Melee attackers take 3 damage.',
    sampleEncounters:'', loot:'Bloodstained dagger, twisted idol, vial of black ichor, shackles inscribed with infernal runes.',
  }},

  { name:'Glabrezu', challenge:'14', tags:'horror,large,demon', stat_data:{
    monsterTier:'entry', category:'Cultists/Horrors', size:'Large',
    description:'Driven by twisted beliefs — a mighty demon lord that tears creatures apart with its dual claws.',
    level:'14', hp:110, armor:'heavy', savedc:17, damagePerRound:'3d6+10',
    attacks:[
      { name:'Doomdaw (2×)', damage:'(Reach 2) 3d6+10', note:'On damage: Grappled (escape DC 17). If same creature is Grappled by both claws, must escape each separately.' },
      { name:'Tear Asunder', damage:'50 unpreventable', note:'Target must be Grappled by both claws. If at 0 HP: DC 17 STR save or be torn in two, dying instantly.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Bloodstained dagger (engraved with dark symbols), twisted idol, vial of black ichor, a mask (carved likeness of a fiend), tattered robe (lined with hidden pockets), shackles inscribed with infernal runes, fragment of a fiendish contract.',
  }},

  // ══════════ UNDERGROUND ═══════════════════════════════════════════════════
  { name:'Giant Spider', challenge:'2', tags:'underground,spider', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Medium',
    description:'Nightmarish denizens of the deep, monstrous beings that lurk in dark tunnels and cavernous depths, ready to ensnare or devour any intruders.',
    level:'2', hp:27, armor:'medium', savedc:11, damagePerRound:'1d8+2',
    attacks:[
      { name:'Shoot Web', damage:'(Range 6) 1d8+2', note:'On hit: Restrained (escape DC 12, or any slashing/fire damage).' },
      { name:'Bite', damage:'2d8+4', note:'Target must be Hampered. Poisoned (magical healing ends).' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Chitinous plating, tunnel map (hastily scrawled), serrated teeth (as many as you can carry), spider silk, venom sac, partially digested meats, gemstones (uncut).',
  }},

  { name:'Ettercap', challenge:'4', tags:'underground,spider,humanoid', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Medium',
    description:'Nightmarish denizens of the deep. A spider-human hybrid that silences its prey.',
    level:'4', hp:49, armor:'none', savedc:12, damagePerRound:'1d8+2',
    attacks:[{ name:'Web Garrote', damage:'1d8+2', note:'On hit: Grappled (escape DC 13), Silenced until target escapes. Silenced: cannot cast spells or use abilities that require speaking.' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:'',
    sampleEncounters:'', loot:'Chitinous plating, tunnel map, spider silk, venom sac, pheromone gland.',
  }},

  { name:'Nestweaver', challenge:'6', tags:'underground,spider,large', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Large',
    description:'Nightmarish denizens of the deep. A spider matron that commands a brood and immobilizes prey.',
    level:'6', hp:54, armor:'medium', savedc:13, damagePerRound:'1d8+2',
    attacks:[
      { name:'Shoot Web', damage:'(Range 6) 1d8+2', note:'On hit: Restrained (escape DC 12, or any slashing/fire damage).' },
      { name:'Bite', damage:'3d8+6', note:'Target must be Hampered. Poisoned (magical healing ends).' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Summon 2 spider minions (d8). Then choose 1 action.',
    sampleEncounters:'', loot:'Chitinous plating, tunnel map, spider silk, venom sac, pheromone gland, luminescent fungus.',
  }},

  { name:'Umber Hulk', challenge:'10', tags:'underground,large,aberration', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Large',
    description:'Nightmarish denizens of the deep. Its pheromones disorient enemies, leaving them at the mercy of its massive claws.',
    level:'10', hp:70, armor:'heavy', savedc:15, damagePerRound:'1d10+10',
    attacks:[{ name:'Mandible & Claws (2×)', damage:'1d10+10', note:'' }],
    familyTrait:'',
    flavorAbilities:[], customAbility:"Confounding Pheromones. Enemies make a DC 15 WIL save at the start of their turns or Confused this turn. Gain advantage 1 on the save for each failure this encounter.\nConfused. The GM spends your next action.",
    sampleEncounters:'', loot:'Chitinous plating, tunnel map, pheromone gland, molted carapace, rusted tools, ancient coins, echo stones (faintly hum when tapped).',
  }},

  { name:'Cloaker', challenge:'13', tags:'underground,large,fly,aberration', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Large',
    description:'Nightmarish denizens of the deep. Lurks on ceilings disguised as a cloak, then smothers victims.',
    level:'13', hp:110, armor:'none', savedc:16, damagePerRound:'2d10+20',
    flySpeed:10,
    attacks:[
      { name:'Wrap', damage:'2d10+20', note:'On Hit: Grappled (escape DC 16).' },
      { name:'Horrifying Wall', damage:'', note:'DC 16 WIL save, or creatures within 6 spaces are Frightened and must spend 1 Action moving as far away as possible.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:"Ambusher. Cloakers always start first and heroes roll Initiative with disadvantage.\nMutual Harm. You take half damage from attacks while grappling a creature (they take the other half).",
    sampleEncounters:'', loot:'Chitinous plating, tunnel map, spider silk, venom sac, pheromone gland, echo stones.',
  }},

  { name:'Great Worm', challenge:'16', tags:'underground,huge,worm,burrow', stat_data:{
    monsterTier:'entry', category:'Underground', size:'Huge',
    description:'Nightmarish denizens of the deep. A colossal burrowing horror that swallows heroes whole.',
    level:'16', hp:140, armor:'none', savedc:18, damagePerRound:'1d4+40',
    burrowSpeed:8,
    attacks:[
      { name:'Crush', damage:'50', note:'2×6 area on a failed DC 18 DEX save (half on save). Creatures who fail can spend 1 Action to dive aside — move half speed, land Prone.' },
      { name:'Bite/Swallow', damage:'1d4+40', note:'On crit: Swallowed. Swallowed: take 20 damage each turn, attacks cannot miss and ignore armor.' },
    ],
    familyTrait:'',
    flavorAbilities:[], customAbility:'Tremor Sight. Advantage against creatures that moved since the worm\'s last turn.',
    sampleEncounters:'', loot:'Chitinous plating, tunnel map, serrated teeth, spider silk, partially digested meats, gemstones (uncut), pheromone gland, luminescent fungus, molted carapace, ancient coins, echo stones.',
  }},

] // end ENTRY

// ─── LEGENDARY MONSTERS ──────────────────────────────────────────────────────

const LEGENDARY = [

  { name:'Pudge the Blunderer', challenge:'2', tags:'legendary,ogre,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 2 Solo Dumb Ogre',
    description:'An enormous ogre of comically poor intelligence but terrifying strength. He throws allies at enemies and can\'t tell the difference.',
    level:'2', hp:75, armor:'medium', savedc:11,
    meleeRange:1, rangedRange:0,
    saves:'STR+ INT-',
    actions:[
      { name:'Move & Smack', description:'Move 8, attack for 1d8+2. On damage: Prone.' },
      { name:'Grab & Throw', description:'1d8+2. On damage: target is thrown at another hero within 6 spaces. Both make a DC 12 DEX save or take 1d8+2 and are knocked Prone, half damage on save.' },
    ],
    bloodied:{ hp:37, effect:'Damage increases to 1d12+2.' },
    lastStand:{ damage:20, effect:'Pudge can move 6 spaces and use Grab & Throw each turn.' },
    passiveAbilities:[],
    blunder:'',
    lootItems:['Scrawled letter from GREETOM', 'Manglemaul (Rare 2-handed Maul) — 1d6+STR bludgeoning; on hit: may Grapple a creature smaller than you (escape DC 10)', 'Abacus with beads of bone, silver, and gold (30 gp)', 'Golden Heart Locket (small portraits inside)'],
  }},

  { name:'Kelebek & Poppy', challenge:'3', tags:'legendary,druid,bug,solo,team', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 3 Solo Bug Druid & His Stinky Pet',
    description:'Kelebek is an Entomancer wizard with an affinity for bugs and a giant stinkbug named Poppy. After each hero\'s turn, choose Kelebek OR Poppy to act.',
    level:'3', hp:120, armor:'medium', savedc:11,
    meleeRange:1, rangedRange:10,
    saves:'INT+ WIL+',
    actions:[
      { name:'Kelebek — Vinelash', description:'Move 6, then 2d6. On damage: move target to an unoccupied space within 10 spaces.' },
      { name:'Poppy — Crushing Mandibles', description:'Move 6. 4d6 damage, up to 2 adjacent creatures.' },
    ],
    bloodied:{ hp:30, effect:'(Kelebek at 30 HP) Poppy always Interposes for him.' },
    lastStand:{ damage:0, effect:'When Poppy dies, the room is filled with noxious gas: all heroes have a maximum of 2 actions each turn.' },
    passiveAbilities:[
      'Kelebek HP: 60. INT+ WIL+. Vinelash attack.',
      'Poppy HP: 60. Heavy Armor. STR+. Stink Cloud: when damaged, enemies within 2 spaces make a STR save (DC = higher of 10 or damage done). On fail, must spend next action vomiting, cannot take reactions.',
      'Crushing Mandibles: Move 6. 4d6 damage to up to 2 adjacent creatures.',
    ],
    blunder:'',
    lootItems:['Rare entomology specimens', 'Bug-catching equipment', 'Alchemical stink glands', 'Druidic nature texts'],
  }},

  { name:'Grimbeak, the Unyielding', challenge:'3', tags:'legendary,owlbear,large,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 3 Solo Large Owlbear',
    description:'A massive owlbear with a savage screech that terrifies all who hear it. She fights until her last breath.',
    level:'3', hp:100, armor:'medium', savedc:11,
    meleeRange:1, rangedRange:0,
    saves:'STR+',
    actions:[
      { name:'Savage Screech', description:'(1 use) All enemies within Reach 12 suffer 2d6 damage (ignoring armor). DC 11 WIL save or Frightened for 1 round.' },
      { name:'Rend & Tear', description:'Attack for 2d6+10 damage.' },
      { name:'Beak', description:'Move 8. Attack for 2d6 damage.' },
    ],
    bloodied:{ hp:50, effect:'Savage Screech recharges.' },
    lastStand:{ damage:30, effect:'Grimbeak is dying! Until then, her Attacks use d10s instead of d6s.' },
    passiveAbilities:['Brutal. Treat the highest die rolled as the Primary Die. On crit: knock Prone.'],
    blunder:'',
    lootItems:['Owlbear feathers (valuable)', 'Talons (crafting material)', 'Beak (crafting material)', 'Owlbear egg (if nest is nearby)'],
  }},

  { name:'Thorn Quickblade', challenge:'4', tags:'legendary,human,criminal,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 4 Solo Human Criminal',
    description:'A deadly human assassin who strikes back on every crit and vanishes into smoke when Bloodied.',
    level:'4', hp:125, armor:'medium', savedc:12,
    meleeRange:1, rangedRange:8,
    saves:'DEX+',
    actions:[
      { name:'Stormquill (Crossbow)', description:'Move 4, 4d4+10 damage (Range 8).' },
      { name:'Heart Piercer (Rapier)', description:'Move 8, 2d4+3 damage. On crit: Dazed.' },
    ],
    bloodied:{ hp:62, effect:'Smoke Bomb. Thorn immediately becomes invisible (until end of his next turn), then moves 8, ignoring opportunity attacks.' },
    lastStand:{ damage:30, effect:"Mortal Panic! Thorn is dying! Until then, he'll Strike Back EVERY time he's hit (1/turn)." },
    passiveAbilities:["Strike Back. When crit, make a Heart Piercer or Stormquill attack in return."],
    blunder:'',
    lootItems:['Stormquill Crossbow (masterwork)', 'Heart Piercer Rapier (masterwork)', 'Smoke bombs (3)', 'Assassin\'s hood', 'Coded contract', 'Gold payment'],
  }},

  { name:'Ravager of the Lowlands', challenge:'5', tags:'legendary,manticore,large,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 5 Solo Large Manticore',
    description:'A feral, flying manticore with a venomous stinger. When crit, it takes flight in a rage.',
    level:'5', hp:130, armor:'medium', savedc:12,
    meleeRange:1, rangedRange:3,
    saves:'STR+ DEX+',
    actions:[
      { name:'Venomous Stinger', description:'(1 use) Reach 3, 5d12 damage.' },
      { name:'Ravage', description:'Attack for 1d12+20 damage.' },
      { name:'Claw', description:'Fly 10, attack for 1d12+6 damage.' },
    ],
    bloodied:{ hp:65, effect:'Venomous Stinger recharges.' },
    lastStand:{ damage:40, effect:'The Ravager is dying! Until then, the first time each turn he takes damage, he uses Move & Claw.' },
    passiveAbilities:['Feral Instinct. Whenever Ravager is crit, he can fly 10.'],
    blunder:'',
    lootItems:['Manticore stinger (rare alchemical ingredient)', 'Hide (tough leather)', 'Tail spines', 'Fangs'],
  }},

  { name:'Queen Aranya, Broodmother', challenge:'6', tags:'legendary,spider,large,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 6 Solo Large Matriarch of Spiders',
    description:'The queen of all spiders. Creatures she hits become entangled in sticky webs. She commands her brood to devour the heroes.',
    level:'6', hp:160, armor:'medium', savedc:13,
    meleeRange:2, rangedRange:0,
    saves:'ALL+',
    actions:[
      { name:'Impale', description:'(Reach 2) 2d8+8 damage. Then skitter away up to 8 spaces.' },
      { name:'Hatch Brood', description:'Summon spiderling minions (1/hero, size: d8); they act only when commanded.' },
      { name:'Dinner Time!', description:'Command all of your spiderling minions to move up to 6 spaces and attack once each.' },
    ],
    bloodied:{ hp:80, effect:'"Avenge Your Queen, My Brood!" Summon 3 spiderling minions/hero anywhere within Reach 8.' },
    lastStand:{ damage:40, effect:'Aranya is dying! Until then, Hatch Brood after each of her turns.' },
    passiveAbilities:["Weave Web. Creatures she hits are entangled in a sticky web (Dazed).", "Flammable Webs. Fire critical hits suppress the Broodmother's Weave Web for 1 turn."],
    blunder:'',
    lootItems:['Silk (enormous quantity, worth a fortune)', 'Venom sac (legendary quality)', 'Crown-like carapace plates', 'Spider eggs (dangerous to keep)'],
  }},

  { name:'Nalzar, Apex Predator', challenge:'6', tags:'legendary,drake,large,solo,fly', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 6 Solo Large Grey Drake',
    description:'A powerful grey drake that tears prone enemies apart and buffets heroes with its wings. Slashing its wings weakens its Wing Buffet.',
    level:'6', hp:180, armor:'medium', savedc:13,
    meleeRange:2, rangedRange:8,
    saves:'STR+ DEX+',
    flySpeed:8,
    actions:[
      { name:'Devour', description:'(Prone creatures only, Reach 2) 4d12+6.' },
      { name:'Wing Buffet', description:'Fly 8, then land. Cone 8: 1d12, then DC 14 STR save or also knocked Prone (advantage if behind cover or another hero).' },
    ],
    bloodied:{ hp:90, effect:"Wing Buffet Range and DC increase by 2." },
    lastStand:{ damage:60, effect:"Nalzar is dying! Until then, each turn, she moves 6, then uses Devour (ignoring the Prone requirement)." },
    passiveAbilities:["Tail Swipe. When dealt slashing or lightning damage: knock a hero within 3 spaces Prone.", "Torn Wings. Each slashing crit reduces the Wing Buffet DC by 1."],
    blunder:'',
    lootItems:['Grey drake scales (rare armor material)', 'Drake fangs', 'Drake claws', 'Drake heart (powerful alchemical ingredient)'],
  }},

  { name:'Florindris, Bane of the Forest', challenge:'7', tags:'legendary,dragon,large,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 7 Solo Large Floral Dragon',
    description:'A beautiful but deadly floral dragon. Her Aura of Wind deflects ranged attacks. She pushes adjacent enemies away at end of each turn.',
    level:'7', hp:200, armor:'medium', savedc:13,
    meleeRange:2, rangedRange:8,
    saves:'ALL+',
    actions:[
      { name:'Petal Storm', description:'(1 use) 3d10+10 damage to all enemies within Reach 8, half on a DC 13 DEX save.' },
      { name:'Rend', description:'Fly 10 before or after attacking. (Reach 2) 1d10+10 damage to up to 2 targets within reach. On hit: Gain Thornblight. Thornblight: Suffer 5 damage for each space you are forcibly moved. Magical healing ends this effect.' },
      { name:'Gust', description:'(Reach 8) Move a target 1d10 spaces.' },
    ],
    bloodied:{ hp:100, effect:'Enemies within Reach 12 gain Thornblight, and Petal Storm recharges.' },
    lastStand:{ damage:70, effect:'Florindris is dying! Until then, Aura of Wind and Gust move creatures twice as far.' },
    passiveAbilities:[
      "Aura of Wind. Ranged attacks against you have disadvantage. End of turn: push adjacent creatures 2 spaces away.",
      "Wither. Resistant to necrotic damage, but it suppresses Aura of Wind for 1 turn.",
    ],
    blunder:'',
    lootItems:['Floral dragon scales (beautiful, rare)', 'Petal glands (aromatic, alchemical)', 'Dragon claws', 'Dragon heart'],
  }},

  { name:'General Flameheart', challenge:'8', tags:'legendary,titan,huge,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 8 Solo Huge Flame Titan',
    description:'A massive, armored flame titan that ignites the battlefield and retaliates with fire. Cold or radiant crits extinguish his flames.',
    level:'8', hp:175, armor:'heavy', savedc:14,
    meleeRange:2, rangedRange:12,
    saves:'STR+ WIL+',
    actions:[
      { name:'Inferno Cleave', description:'Move 8, then strike a 2×2 square area for 2d10+10 fire damage.' },
      { name:'Molten Fury', description:'Lob a molten fireball at the furthest hero not already in the flames, igniting a 2×2 square area. Creatures there take 2d10+10 damage; and another 10 damage at the end of each of their turns if they remain in the area.' },
    ],
    bloodied:{ hp:87, effect:'On his next turn, he uses Molten Fury a number of times equal to half the number of heroes (rounded up).' },
    lastStand:{ damage:80, effect:'Flameheart is dying! Until then, the area of his attacks increase to a 3×3 square.' },
    passiveAbilities:[
      "Cinder Armor. Immune to fire. When damaged, deal 5 fire damage to all adjacent creatures.",
      "Extinguish Flame. Cold or radiant crits extinguish all areas ignited by Molten Fury and suppress Cinder Armor for 1 turn.",
    ],
    blunder:'',
    lootItems:['Flameheart\'s weapon (scorched metal)', 'Cinder plates (heavy armor scraps)', 'Flame titan core (powerful fire source)', 'Molten gold pooled in craters'],
  }},

  { name:'Vael, Undying Necromancer', challenge:'9', tags:'legendary,necromancer,solo,undead', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 9 Solo Luminary of Malice',
    description:'A powerful necromancer who sacrifices his Lifebinding Spirit (Bane) to negate damage. When Bloodied, gains a radiant-reflecting shield.',
    level:'9', hp:250, armor:'none', savedc:14,
    meleeRange:1, rangedRange:8,
    saves:'INT++ WIL++',
    actions:[
      { name:'Bane attacks', description:"Bane attacks for 1d12+6, then Vael chooses one action." },
      { name:'DOOM', description:'(Range 12, undamaged target) DC 14 WIL save or 5d12 damage. Half on save.' },
      { name:"Veilwalker's Rebuke", description:'(Range 8) 2d12+6. Double damage against those behind cover. 1/round you may swap places with places with them.' },
      { name:"Cruelty's Edge", description:'1d4+2. On hit: DC 14 WIL save or Dazed and Frightened. Then move 6.' },
    ],
    bloodied:{ hp:125, effect:'Vael gains the reaction Shield of Cruelty (1 time use): If Vael would take radiant damage, instead reflect that much radiant damage back at the attacker.' },
    lastStand:{ damage:90, effect:"DEATH, AN OLD FRIEND. Vael is dying! Until then, the hero that most recently damaged him is reduced to 0 HP, and Bane is sacrificed into a Vengeful Spirit. It deals 1d12+6 necrotic damage to creatures within reach 3 at the end of each of his turns." },
    passiveAbilities:["Protect Master! Whenever Vael would fail a save or take 20 or more damage, he may sacrifice his Lifebinding Spirit (Bane) instead. He spends his next turn moving up to 6 spaces and summoning Bane."],
    blunder:'',
    lootItems:['Vael\'s staff', 'Necromantic grimoire', 'Lifebinding crystal (Bane\'s vessel)', 'Dark robes', 'Soul gems'],
  }},

  { name:'Titan of the Deep Woods', challenge:'10', tags:'legendary,skeleton,gargantuan,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 10 Solo Gargantuan Skeleton',
    description:'An ancient colossus of bone that splinters on crits, forming new minions from the debris. Resistant to piercing, vulnerable to bludgeoning.',
    level:'10', hp:240, armor:'heavy', savedc:15,
    meleeRange:4, rangedRange:0,
    saves:'STR+++',
    actions:[
      { name:'Devastating Strike', description:'(Reach 4) 1d4+30 damage. On hit: Knockback 6 damage to up to 2 targets along the path.' },
      { name:'Crushing Stomp', description:'Move up to 10 spaces. Deal 1d4+20 damage to targets along the path. On hit: Prone.' },
      { name:'Beckoning Doom', description:'The 2 furthest heroes make a DC 16 STR save or are moved adjacent to Titan.' },
    ],
    bloodied:{ hp:0, effect:'N/A — see Last Stand.' },
    lastStand:{ damage:0, effect:'Shattered Legion. At 0 HP Titan collapses into 4 skeleton minions/hero (d10 sized). If any remain, they reassemble into the Titan the next evening.' },
    passiveAbilities:[
      "Splintering Legions. Bludgeoning damage or any crit cause bones to splinter off and animate, forming a d10 minion.",
      "Brittle Bones. Resistant to piercing, vulnerable to bludgeoning.",
    ],
    blunder:'',
    lootItems:['Ancient bones (valuable to necromancers)', 'Embedded treasures (accumulated over centuries)', 'Bone dust (alchemical ingredient)'],
  }},

  { name:"Ul'vek, Psionic Despot", challenge:'11', tags:'legendary,aberration,solo,psionic', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 11 Solo Medium Brain-Eating Aberration',
    description:"A terrifying psionic predator that Dominates heroes and uses them against each other. His Mind Shield lets him avoid damage by releasing Dominated creatures.",
    level:'11', hp:300, armor:'none', savedc:15,
    meleeRange:1, rangedRange:8,
    saves:"INT++ WIL++ DEX+",
    actions:[
      { name:'Dominate', description:"(If no creatures are Dominated) Choose half the heroes to suffer 2d12 psychic damage (ignoring armor). DC 15 WIL save or Dominated as well. Dominated: Rolls are made with disadvantage. Ul'vek spends your first action each turn moving, making a weapon attack, or casting a cantrip. Damage ends." },
      { name:'Consume', description:"Contested DEX or STR check. On success: Grappled and 6d12. Cannot be Defended or Interposed against." },
      { name:'Control', description:"(Reach 8) DC 15 WIL save, force an enemy to spend one Action to make a weapon attack or cast a cantrip. On save: they attack with disadvantage." },
    ],
    bloodied:{ hp:150, effect:"Gain Illusory Shift. Reaction when attacked (1 use): Swap places with a Dominated creature, making them the new target of the attack." },
    lastStand:{ damage:110, effect:"Ul'vek is dying! Until then, Dominated no longer ends on taking damage. Every hero makes a WIL save or become Dominated." },
    passiveAbilities:["Mind Shield. Whenever Ul'vek would fail a save or take more than 30 damage while he has a creature Dominated, he may avoid the attack instead, but all Dominated creatures come to their senses."],
    blunder:'',
    lootItems:["Ul'vek's cranial plating", 'Psionic crystal (stores memories)', 'Aberrant flesh (dangerous alchemical)', 'Echo stones (faintly hum when tapped)'],
  }},

  { name:'Dravok, All-Seeing Tyrant', challenge:'12', tags:'legendary,aberration,large,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 12 Solo Large Aberration, all TEETH & EYES',
    description:"A beholder-like tyrant whose plans are FLAWLESS. He rolls saves with +1 Advantage and attacks against him have Disadvantage — until he takes more than 12 piercing or slashing damage in a turn.",
    level:'12', hp:325, armor:'none', savedc:16,
    meleeRange:1, rangedRange:10,
    saves:"INT++ WIL++",
    actions:[
      { name:'Eye Ray + Terrible Maw', description:"Move 6 and choose Eye Ray target, then choose Terrible Maw OR another Eye Ray. Eye Ray (Range 10, randomly chosen): 1. Warping Ray — 3d6. On hit: Dazed, exchange places. 2. Petrification Ray — Permanently Dazed. Healing ends. (3 stacks, Petrified.) 3. Terror Ray — 5d10 psychic & Terrified: Frightened, screams give allies within 6 disadvantage. Ends when plans are FLAWED. 4. Gravitation Ray — 2d6, push that many spaces, Prone on 7+. 5. Charm Ray — DC 16 WIL save or spend 3 Actions attacking with or moving toward Dravok. 6. Death Ray — DC 16 STR save or drop to 0 HP; gain 1 Wound. If Dying creature fails, they die." },
      { name:'Terrible Maw', description:"Melee attack. 4d4. EVERY die can crit and is Vicious." },
    ],
    bloodied:{ hp:110, effect:'Use Petrification Ray against every enemy. His save DC increases to 18.' },
    lastStand:{ damage:70, effect:"Dravok is dying! Until then, each turn he will move or use Warping Ray and then Devastation Beam: 2d12+20 in a 10 space long, 2 space wide line." },
    passiveAbilities:["My plans, flawless! Dravok makes all saves with +1 Advantage, attacks against him have Disadvantage.", "Weakness: Taking more than 12 piercing or slashing damage: Dravok's plans are FLAWED! (until the end of the next hero's turn.)"],
    blunder:'',
    lootItems:["Dravok's central eye (rare magical component)", 'Eye stalks (alchemical)', 'Beholder hide (aberrant leather)', 'Trapped memories (crystal spheres)'],
  }},

  { name:'Azriel, Lord of Pain & Flame', challenge:'14', tags:'legendary,balor,huge,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 14 Solo Huge Balor Feeling Hot & Spicy',
    description:'A mighty balor lord armed with a crackling whip that drags heroes to him, and a doom sword of cleaving fire. Every crit against him is Vicious — it deals damage equal to the crit dice back to the attacker.',
    level:'14', hp:320, armor:'heavy', savedc:17,
    meleeRange:2, rangedRange:6,
    saves:'ALL+',
    actions:[
      { name:'Crackling Whip', description:'(Reach 6) 3d12 damage. On hit: Grappled and pulled adjacent to Azriel (escape DC 17, DEX, or until he uses the whip again).' },
      { name:'Doom Sword', description:'3d12+10 fire damage to all creatures within Reach 2.' },
    ],
    bloodied:{ hp:160, effect:'Azriel can use Crackling Whip twice each turn.' },
    lastStand:{ damage:180, effect:"YES, MORE PAIN! Azriel is dying! Until then, EVERY hit against him is a crit." },
    passiveAbilities:["PAIN! Crits against Azriel are Vicious. He deals damage equal to the crit dice back to the attacker."],
    blunder:'',
    lootItems:["Azriel's crackling whip", 'Balor wing membranes', 'Infernal chains', 'Hellfire core', 'Demonic contract'],
  }},

  { name:'Gloomwing the Cruel', challenge:'15', tags:'legendary,dragon,huge,solo,undead', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 15 Solo Huge Rot Dragon',
    description:"A massive rot dragon whose Aura of Rot poisons all nearby. Her Cruelty's Gift halves healing. Radiant damage suppresses her rot aura.",
    level:'15', hp:320, armor:'heavy', savedc:17,
    meleeRange:2, rangedRange:10,
    saves:'ALL++',
    actions:[
      { name:'Rot Breath', description:'(1 use) Fly 10, then (Cone 8) DC 17 DEX save or 8d10 necrotic, half on save.' },
      { name:'Bite', description:"(Reach 2) Move 6, then 3d10. On damage: Cruelty's Gift. Cruelty's Gift: Healing is halved and Vulnerable to necrotic damage. Healing ends." },
      { name:'Claws', description:'(Reach 2) 3d10 slashing +10 necrotic.' },
      { name:'Tail', description:'(Reach 4) 1d10, and knocked back that many spaces.' },
    ],
    bloodied:{ hp:160, effect:"Gloomwing's Rot Breath recharges." },
    lastStand:{ damage:150, effect:"Gloomwing is dying! Until then, the damage and range of her Aura of Rot is doubled." },
    passiveAbilities:[
      "Aura of Rot. Creatures within 6 spaces take 5 necrotic damage at the end of their turns.",
      "Light Sensitivity. Radiant damage suppresses Aura of Rot until the end of the next hero's turn.",
    ],
    blunder:'',
    lootItems:['Rot dragon scales (cursed armor material)', 'Necrotic glands', 'Dragon bones (blackened)', 'Dragon heart (corrupted)'],
  }},

  { name:'Alaric Draegoth, the Crimson Count', challenge:'16', tags:'legendary,vampire,solo', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 16 Solo Vampire Lord',
    description:"An aristocratic vampire lord who summons blood bat minions, Beguiles his foes, and drains their life through his Sanguine Cloak. Vulnerable to radiant — until Bloodied.",
    level:'16', hp:320, armor:'none', savedc:18,
    meleeRange:1, rangedRange:0,
    saves:'ALL++',
    actions:[
      { name:'Summon + Action', description:'Summon 1 blood bat minion (d10) within 8 spaces, then choose one:' },
      { name:'Ebonfang', description:'Deal 1d10+15 damage, your target is considered Bloodied for 1 round. Fly 8 before or after attacking.' },
      { name:'Beguile', description:'If no creature is Beguiled, Beguile a target on a failed DC 18 WIL save (with disadvantage if Bloodied). Beguiled: Dazed. Cannot Defend or allow anyone to Interpose for you. Damage ends.' },
      { name:'Beckon & Bite', description:'Move a Beguiled creature adjacent to you and bite them: 2d10+30 damage and 1 Wound.' },
    ],
    bloodied:{ hp:160, effect:"Gain Mistform. Not vulnerable to radiant. Bat Decoy: whenever Alaric would take damage, instead first swap places with a bat minion, 1/round." },
    lastStand:{ damage:160, effect:"Alaric is dying! Until then, his Sanguine Cloak, attacks, and bats roll d20s instead of d10s." },
    passiveAbilities:[
      "Sanguine Cloak. (1/turn) Deal 1d10 necrotic damage whenever you are hit; the attack is reduced by this amount.",
      "Sunscorn. Vulnerable to radiant. After taking radiant damage, use Beguile as a Reaction; they roll with disadvantage.",
    ],
    blunder:'',
    lootItems:["Alaric's signet ring (family crest)", 'Crimson cloak (magical, cursed)', 'Blood rubies', 'Ancient vampire tome', 'Castle deed', 'Casket of treasured victims\' possessions'],
  }},

  { name:'Caerys, the Hollow Star', challenge:'20', tags:'legendary,cataclysm,solo,world-ending', stat_data:{
    monsterTier:'legendary',
    epithet:'Level 20 Solo World-Ending Cataclysm',
    description:"A world-ending cosmic horror. At the start of each round, ALL heroes suffer 1 Wound. She can cycle through all 6 actions — rotating through them and resetting. She can swap places with any creature to negate damage (Slipstream). If she survives 1 round of Last Stand, she resets to full HP.",
    level:'20', hp:620, armor:'heavy', savedc:20,
    meleeRange:2, rangedRange:12,
    saves:'ALL+++',
    actions:[
      { name:'Wormhole', description:'Teleport 12. 3d20 damage to a creature adjacent to where you began or ended.' },
      { name:'Immensity', description:'(Reach 12) DC 20 STR save (disadvantage if within Reach 4) or suffer 3d20 damage and Prone. Half on save.' },
      { name:'Glimpse Your End', description:'DC 20 WIL save or DOOMED: Concentration ends, the next damage roll against you is maximized.' },
      { name:'Plasma Storm', description:'Reach 6. DC 20 DEX save or 2d20 lightning and 2d20 fire damage. Half on save.' },
      { name:'Singularity', description:'Reach 2. 5d20 bludgeoning damage.' },
      { name:'Almighty Push & Pull', description:'(Range 12) DC 20 STR save or be launched 20 ft. into the air, repeat until the target saves. Fall damage for this attack is 1d20 for every 10 ft. fallen.' },
    ],
    bloodied:{ hp:310, effect:'Gravitational Mastery. Move ALL objects and creatures within 16 spaces anywhere else within the area. Gravitational Lensing: The hero with the most HP is marked by Caerys. She takes half damage from all sources, her mark takes the other half. This lasts until the mark drops to 0 HP.' },
    lastStand:{ damage:200, effect:"Use Gravitational Mastery, then Caerys is dying! Until then she chooses twice each turn. If still alive after 1 round: Reset Time! She resets back to full HP." },
    passiveAbilities:[
      "Ravages of Time. At the beginning of each round, all heroes suffer 1 Wound.",
      "Slipstream. 3/encounter when she would suffer any negative effect she can swap places with a creature of her choice making them the target instead. All heroes recover 1 Wound.",
    ],
    blunder:'',
    lootItems:['Hollow Star fragment (world-altering material)', 'Caerys\'s eye (cosmic artifact)', 'Gravitational lens crystal', 'Void-touched weapons', 'The last light of a dead star'],
  }},

] // end LEGENDARY

// ─── INSERT LOGIC ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('🪨  Sisyphus Bestiary Seeder — Nimble RPG')
  console.log(`    User: ${USER_ID}`)

  // 1. Wipe existing Nimble monsters for this user
  const del = await db.query(
    'DELETE FROM monsters WHERE user_id = $1 AND game_system = $2',
    [USER_ID, GAME_SYSTEM]
  )
  console.log(`    Deleted ${del.rowCount} existing Nimble monsters.`)

  // 2. Insert entry monsters
  let entryCount = 0
  for (const m of ENTRY) {
    await db.query(
      `INSERT INTO monsters (user_id, game_system, name, challenge, tags, stat_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [USER_ID, GAME_SYSTEM, m.name, m.challenge, m.tags, JSON.stringify(m.stat_data)]
    )
    entryCount++
    process.stdout.write(`\r    Entry monsters inserted: ${entryCount}/${ENTRY.length}`)
  }
  console.log()

  // 3. Insert legendary monsters
  let legCount = 0
  for (const m of LEGENDARY) {
    await db.query(
      `INSERT INTO monsters (user_id, game_system, name, challenge, tags, stat_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [USER_ID, GAME_SYSTEM, m.name, m.challenge, m.tags, JSON.stringify(m.stat_data)]
    )
    legCount++
    process.stdout.write(`\r    Legendary monsters inserted: ${legCount}/${LEGENDARY.length}`)
  }
  console.log()

  console.log(`\n✅  Done! ${entryCount} entry + ${legCount} legendary = ${entryCount + legCount} total Nimble monsters seeded.`)
  console.log('    Note: Medium Mimic HP (~55) is an estimate — verify against book.')
  process.exit(0)
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message)
  process.exit(1)
})
