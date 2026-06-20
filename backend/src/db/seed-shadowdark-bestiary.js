#!/usr/bin/env node
// Shadowdark RPG Bestiary seed for ragnarok1414
// Sources: Core Book + Cursed Scrolls 1-6
// Run from project root: node backend/src/db/seed-shadowdark-bestiary.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const db = require('./index')

const USER_ID     = '0621b230-8244-4d0a-bf1d-ede3d6b0f792'
const GAME_SYSTEM = 'shadowdark'

function hitDieForLevel(lv) {
  if (lv <= 1) return 'd6'
  if (lv <= 4) return 'd8'
  if (lv <= 8) return 'd10'
  return 'd12'
}
function autoRole(lv, tlnts) {
  const hasSpell = tlnts.some(t => /spell/i.test(t.description || ''))
  if (lv <= 2) return 'mook'
  if (hasSpell && lv >= 4) return 'controller'
  if (lv >= 10) return 'tank'
  if (lv >= 6) return 'striker'
  return 'soldier'
}
function m(name, lv, ac, hp, mv, al, str, dex, con, int_, wis, cha, atks, tlnts, tags, role) {
  return { name, challenge: String(lv), tags,
    stat_data: { description: '', combatRole: role || autoRole(lv, tlnts),
      level: lv, ac, hp, movement: mv, hitDie: hitDieForLevel(lv),
      stats: { str, dex, con, int: int_, wis, cha }, alignment: al,
      attacks: atks, talents: tlnts } }
}
function a(count, weapon, range, bonus, damage, connector) {
  return { count, weapon, range: range||'', bonus: bonus||0, damage: damage||'', connector: connector||'' }
}
function t(name, desc) { return { name, description: desc||'' } }

// ─── CORE BOOK ───────────────────────────────────────────────────────────────
const CORE = [
  m('Aboleth',8,16,39,'near (swim)','chaotic',4,-1,3,4,2,2,
    [a(2,'tentacle','near',5,'1d8','or'),a(1,'tail','',5,'3d6','')],
    [t('Curse','DC15 CHA or enslaved'),t('Enslave','DC15 CHA near dominated'),t('Telepathic','read minds near')],'shadowdark,core'),

  m('Acolyte',1,12,4,'near','lawful',1,-1,0,-1,2,0,
    [a(1,'mace','',1,'1d6','or'),a(1,'spell','',2,'','')],
    [t('Healing Touch','WIS restore 1d4 HP')],'shadowdark,core'),

  m('Archangel',16,18,76,'double-near (fly)','lawful',5,2,4,4,5,5,
    [a(3,'flaming-greatsword','',10,'2d12','')],
    [t('Command','DC15 CHA near halt'),t('Crown of Fire','immune fire; melee attackers 1d6')],'shadowdark,core','legendary'),

  m('Angel Domini',9,17,42,'double-near (fly)','lawful',4,1,2,3,4,4,
    [a(3,'bastard-sword','',7,'1d8','or'),a(1,'horn','',0,'','')],
    [t('Horn','DC15 CON near stun 1d4 rds')],'shadowdark,core'),

  m('Angel Principi',11,16,53,'double-near (fly)','lawful',4,2,4,4,4,4,
    [a(3,'silvered-bastard-sword','',9,'1d10','')],
    [t('Moonlight Aura','near 2d6 to undead/fiends each turn'),t('Truesight','see invisible/hidden')],'shadowdark,core'),

  m('Angel Seraph',3,14,14,'near (fly)','lawful',3,1,1,2,3,3,
    [a(2,'longsword','',3,'1d8','')],
    [t('Bless','WIS +1d4 near allies 5 rds')],'shadowdark,core'),

  m('Animated Armor',2,15,11,'near','chaotic',3,-1,2,-1,1,0,
    [a(1,'longsword','',3,'1d8','')],
    [t('Statue','DC15 INT to identify while motionless')],'shadowdark,core'),

  m('Ape',2,12,10,'near (climb)','neutral',2,2,1,-2,1,0,
    [a(1,'fist','',2,'1d6','or'),a(1,'rock','far',2,'1d4','')],
    [],'shadowdark,core'),

  m('Ape Snow',4,13,19,'near (climb)','neutral',3,1,1,-2,1,0,
    [a(2,'fist','',4,'1d6','or'),a(1,'rock','far',4,'2d6','')],
    [t('Thick Fur','immune to cold')],'shadowdark,core'),

  m('Ankheg',3,14,14,'near (burrow)','neutral',2,2,1,-2,1,-2,
    [a(1,'bite','',4,'1d6','or'),a(1,'acid-spray','near',4,'2d6','')],
    [],'shadowdark,core'),

  m('Apprentice',1,11,3,'near','neutral',-1,1,-1,2,0,0,
    [a(1,'dagger','close/near',1,'1d4','or'),a(1,'spell','',2,'','')],
    [t('Beguile','INT DC11 near charmed'),t('Magic Bolt','INT DC11 1d4 dmg')],'shadowdark,core'),

  m('Archmage',10,12,44,'near','lawful',-1,2,-1,4,2,1,
    [a(2,'spell','',7,'','')],
    [t('Death Bolt','INT near DC15 CON 3d10'),t('Enervate','INT near 2d6 CON drain'),t('Fireblast','INT DC15 DEX double-near 4d8'),t('Float','fly double-near'),t('Mithralskin','INT AC18 5 rds'),t('Void Step','INT teleport far')],'shadowdark,core'),

  m('Assassin',8,15,38,'near (climb)','chaotic',2,4,2,2,3,3,
    [a(2,'poisoned-dagger','close/near',6,'2d4','')],
    [t('Execute','triple dmg vs surprised')],'shadowdark,core'),

  m('Azer',3,15,15,'near','lawful',3,0,2,0,0,0,
    [a(2,'flaming-warhammer','',3,'1d10','or'),a(1,'crossbow','far',0,'1d6','')],
    [t('Impervious','immune to fire')],'shadowdark,core'),

  m('Badger',1,11,5,'near (burrow)','neutral',2,0,1,-3,1,-2,
    [a(2,'claw','',2,'1d4','')],
    [t('Rage','when injured attack again')],'shadowdark,core'),

  m('Bandit',1,13,4,'near','chaotic',1,0,0,-1,0,-1,
    [a(1,'club','',1,'1d4','or'),a(1,'shortbow','far',0,'1d4','')],
    [t('Ambush','surprise on 1-3 on d6')],'shadowdark,core'),

  m('Basilisk',5,14,25,'near','neutral',3,0,1,-3,1,-3,
    [a(2,'bite','',4,'2d6','')],
    [t('Petrify','DC15 CON or petrified')],'shadowdark,core'),

  m('Bat Giant',2,12,9,'near (fly)','neutral',-1,2,0,-3,1,-3,
    [a(1,'bite','',2,'1d6','')],
    [],'shadowdark,core'),

  m('Bat Swarm',4,12,18,'near (fly)','neutral',-3,2,0,-3,1,-3,
    [a(3,'bite','',2,'1d6','')],
    [],'shadowdark,core'),

  m('Bear Brown',5,13,25,'near (climb)','neutral',4,0,3,-2,1,-2,
    [a(2,'claw','',4,'1d8','')],
    [t('Crush','extra 1d8 if both claws hit')],'shadowdark,core'),

  m('Bear Polar',7,13,34,'near (climb)','neutral',4,1,3,-2,1,-2,
    [a(2,'claw','',6,'2d6','')],
    [t('Crush','extra die if both claws hit'),t('Thick Fur','immune to cold')],'shadowdark,core'),

  m('Beastman',1,12,5,'near','chaotic',2,1,1,-2,1,-1,
    [a(1,'spear','close/near',2,'1d6+1','')],
    [t('Brutal','+1 dmg included')],'shadowdark,core'),

  m('Berserker',2,12,10,'near','neutral',2,1,1,0,1,0,
    [a(1,'greataxe','',2,'1d10','or'),a(1,'spear','close/near',2,'1d6','')],
    [t('Rage','when injured +2 attacks next turn')],'shadowdark,core'),

  m('Black Pudding',6,9,30,'near (climb)','neutral',2,-1,3,-4,-3,-4,
    [a(3,'tentacle','',4,'2d6','')],
    [t('Impervious','immune to fire'),t('Corrosive','destroys metal on contact')],'shadowdark,core'),

  m('Boar',3,12,14,'near','neutral',3,0,1,-2,1,-2,
    [a(2,'tusk','',3,'1d6','')],
    [t('Gore','both tusks hit = extra dmg die')],'shadowdark,core'),

  m('Brain Eater',8,14,36,'near','chaotic',2,3,0,4,2,4,
    [a(4,'tentacle','',5,'1d8','or'),a(1,'mind-blast','','','',' or'),a(1,'mind-control','','','','')],
    [t('Hear Thoughts','read minds near'),t('Latch','auto-hit after tentacle grab'),t('Mind Blast','DC15 INT near cube 3d6+paralyzed'),t('Mind Control','DC15 CHA near 1d4 rds')],'shadowdark,core'),

  m('Bugbear',3,13,14,'near','chaotic',3,0,1,-1,0,-2,
    [a(2,'spiked-mace','',3,'1d6','')],
    [t('Stealthy','surprise on 1-3')],'shadowdark,core'),

  m('Bulette',8,17,40,'near (burrow)','neutral',5,1,4,-3,1,-2,
    [a(3,'bite','',5,'2d6','or'),a(1,'leap','','','','')],
    [t('Leap','jump near height, double-near dist; 2 bite attacks on landing')],'shadowdark,core'),

  m('Camel',2,10,12,'double-near','neutral',3,0,3,-2,1,-3,
    [a(1,'hoof','',3,'1d6','or'),a(1,'spit','near',0,'1d4','')],
    [],'shadowdark,core'),

  m('Cave Brute',6,14,28,'near (burrow)','neutral',4,1,1,-3,1,-3,
    [a(2,'claw','',5,'1d8','and'),a(1,'mandible','',5,'1d10','')],
    [t('Bewilder','DC12 CHA or dazed 1 rd')],'shadowdark,core'),

  m('Cave Creeper',4,12,18,'near (climb)','neutral',2,2,0,1,1,-3,
    [a(1,'bite','',3,'1d6','and'),a(1,'tentacles','',3,'1d8','')],
    [t('Toxin','DC12 CON or paralyzed')],'shadowdark,core'),

  m('Centaur',3,12,14,'double-near','neutral',2,1,1,0,2,1,
    [a(2,'spear','close/near',2,'1d6','or'),a(1,'longbow','far',1,'1d8','')],
    [],'shadowdark,core'),

  m('Centipede Giant',1,11,4,'near (climb)','neutral',-3,1,0,-4,-3,-4,
    [a(1,'bite','',1,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Centipede Swarm',4,11,18,'near (climb)','neutral',-3,1,0,-4,-3,-4,
    [a(3,'bite','',1,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Chimera',10,16,49,'double-near (fly)','chaotic',5,4,4,-3,2,-1,
    [a(4,'rend','',7,'2d8','and'),a(1,'fire-breath','','','','')],
    [t('Fire Breath','near cube DC15 DEX 4d6')],'shadowdark,core'),

  m('Chuul',5,15,25,'near (swim)','chaotic',3,-1,3,-1,1,-2,
    [a(2,'pincer','',4,'1d8','')],
    [t('Grab','DC15 STR or grappled')],'shadowdark,core'),

  m('Cloaker',6,13,28,'near (fly)','chaotic',2,3,1,1,1,0,
    [a(3,'lash','',4,'1d8','or'),a(1,'screech','','','','')],
    [t('Phantoms','3 illusions 1/day'),t('Screech','DC15 WIS disadvantage 1d4 rds')],'shadowdark,core'),

  m('Cockatrice',3,11,14,'near (fly)','neutral',-2,1,1,-3,1,-3,
    [a(1,'bite','',1,'1d4','')],
    [t('Petrify','DC12 CON or petrified')],'shadowdark,core'),

  m('Couatl',9,16,42,'near (fly)','lawful',2,3,2,4,4,5,
    [a(3,'bite','',6,'2d6','')],
    [t('Change Shape','humanoid or serpent'),t('Poison','DC15 CON sleep 1d8 hrs'),t('Restore','touch remove curse/disease or 3d8 HP')],'shadowdark,core'),

  m('Crab Giant',5,15,24,'near (swim)','neutral',3,0,2,-3,0,-3,
    [a(2,'pincer','',4,'1d8','')],
    [t('Crush','DC15 STR or 1d8 extra dmg')],'shadowdark,core'),

  m('Crocodile',4,14,20,'near (swim)','neutral',3,1,2,-2,1,-2,
    [a(2,'bite','',3,'1d8','')],
    [],'shadowdark,core'),

  m('Cultist',2,14,9,'near','chaotic',1,-1,0,-1,2,0,
    [a(1,'longsword','',1,'1d8','or'),a(1,'spell','',2,'','')],
    [t('Fearless','immune to morale'),t('Deathtouch','WIS DC12 2d4 close')],'shadowdark,core'),

  m('Cyclops',8,11,38,'double-near','chaotic',5,0,2,-1,-2,0,
    [a(2,'greatclub','',7,'2d8','or'),a(1,'rock','far',5,'1d12','')],
    [],'shadowdark,core'),

  m('Darkmantle',1,13,4,'near (fly)','neutral',-2,3,0,-3,0,-3,
    [a(1,'bite','',3,'1d4','or'),a(1,'darkness','','','','')],
    [t('Darkness','extinguish all light in near')],'shadowdark,core'),

  m('Deep One',2,13,10,'near (swim)','chaotic',2,1,1,-2,0,-2,
    [a(2,'spear','close/near',2,'1d6','')],
    [t('Sunblind','disadvantage in sunlight')],'shadowdark,core'),

  m('Demon Balor',16,19,77,'double-near (fly)','chaotic',6,2,5,4,3,4,
    [a(3,'greatsword','',10,'2d12','and'),a(1,'fire-whip','near',10,'2d6','')],
    [t('Impervious','immune fire/magical'),t('Grab','DC18 STR or 2d6/rd'),t('Hellfire','DC18 DEX 2d8/rd')],'shadowdark,core','legendary'),

  m('Demon Dretch',2,12,11,'near','chaotic',2,0,2,-2,-1,-3,
    [a(1,'claw','',2,'1d6','or'),a(1,'gas','','','','')],
    [t('Gas','near DC12 CON blinded 1d4 rds')],'shadowdark,core'),

  m('Demon Glabrezu',8,15,40,'near','chaotic',4,1,4,3,2,2,
    [a(2,'pincer','',7,'2d8','')],
    [t('Crush','DC15 STR or 2d8 dmg')],'shadowdark,core'),

  m('Demon Marilith',9,17,43,'near (climb)','chaotic',5,4,3,3,3,4,
    [a(6,'longsword','',7,'1d8','')],
    [t('Parry','spend 2 attacks to deflect 1 attack')],'shadowdark,core'),

  m('Demon Vrock',5,14,24,'near (fly)','chaotic',2,2,2,-1,1,0,
    [a(2,'talons','',4,'1d8','or'),a(1,'screech','','','','')],
    [t('Carrion Mist','3-in-6 on hit DC15 CON vomiting 1 rd'),t('Screech','DC12 WIS disadvantage 1d4 rds')],'shadowdark,core'),

  m('Archdevil',16,19,76,'far (teleport)','chaotic',5,4,4,5,4,7,
    [a(4,'iron-scepter','',10,'3d10','or'),a(1,'soulbind','','','','')],
    [t('Impervious','immune fire/magical'),t('Crown of Darkness','spells below LV20 reflected'),t('Soulbind','DC20 CHA near control')],'shadowdark,core','legendary'),

  m('Devil Barbed',3,13,14,'near','chaotic',2,3,1,1,1,1,
    [a(2,'spine','near',3,'1d6','or'),a(1,'fire-blast','far',3,'1d8','')],
    [t('Barb','1d4/rd; DC12 STR to remove')],'shadowdark,core'),

  m('Devil Cubi',6,14,29,'near (fly)','chaotic',2,4,2,3,2,5,
    [a(1,'kiss','',4,'1d6','or'),a(1,'charm','','','','')],
    [t('Change Shape','any humanoid'),t('Charm','DC15 CHA 1d6 hrs'),t('Drain','kiss 1d6 WIS dmg; 0 WIS = soul sworn')],'shadowdark,core'),

  m('Devil Erinyes',9,17,43,'double-near (fly)','chaotic',4,4,3,4,4,5,
    [a(3,'greatsword','',8,'1d12','or'),a(2,'longbow','far',8,'1d8','')],
    [t('Poison','DC15 CON or turn on allies 1d4 rds')],'shadowdark,core'),

  m('Devil Horned',7,16,35,'double-near (fly)','chaotic',5,2,4,2,1,2,
    [a(2,'burning-trident','near',7,'2d6','or'),a(1,'fire-blast','far',4,'2d8','')],
    [t('Iron Hide','half dmg from non-magical weapons')],'shadowdark,core'),

  m('Devil Imp',2,13,9,'near (fly)','chaotic',-2,3,0,1,0,2,
    [a(1,'stinger','',3,'1d4','')],
    [t('Impervious','immune fire'),t('Contract','can bind souls'),t('Poison','DC12 CON sleep 1d4 hrs')],'shadowdark,core'),

  m('Brachiosaurus',12,13,57,'double-near','neutral',6,-1,3,1,1,-3,
    [a(3,'stomp','',7,'2d10','')],
    [],'shadowdark,core'),

  m('Plesiosaur',6,13,30,'double-near (swim)','neutral',4,3,3,-3,1,-3,
    [a(2,'bite','',5,'2d8','')],
    [],'shadowdark,core'),

  m('Pterodactyl',4,14,20,'double-near (fly)','neutral',2,4,2,-2,1,-3,
    [a(2,'beak','',4,'1d8','')],
    [t('Grab','DC15 STR steal 1 gear item')],'shadowdark,core'),

  m('Triceratops',7,17,35,'near','neutral',4,-1,4,-3,1,-3,
    [a(2,'horns','',6,'1d10','or'),a(1,'charge','','','','')],
    [t('Charge','move double-near in line; horn hit deals triple dmg')],'shadowdark,core'),

  m('Tyrannosaurus',9,13,44,'double-near','neutral',5,1,4,-3,1,-3,
    [a(3,'bite','',8,'2d12','')],
    [],'shadowdark,core'),

  m('Velociraptor',2,13,10,'double-near','neutral',-1,3,1,-2,1,-3,
    [a(1,'claw','',3,'1d6','')],
    [t('Clever','+1d4 dmg on surprise')],'shadowdark,core'),

  m('Djinni',10,14,48,'double-near (fly)','neutral',4,4,3,4,3,3,
    [a(3,'scimitar','',7,'1d12','or'),a(1,'whirlwind','','','','')],
    [t('Impervious','immune magical'),t('Whirlwind','DC18 DEX near flung 2d100ft'),t('Wish','1/wk')],'shadowdark,core'),

  m('Doppelganger',4,12,20,'near','chaotic',2,2,2,1,0,4,
    [a(1,'dagger','close/near',2,'1d4','')],
    [t('Change Shape','any humanoid'),t('Telepathy','read thoughts')],'shadowdark,core'),

  m('Dragon Desert',13,17,61,'double-near (fly)','lawful',5,3,3,4,5,5,
    [a(3,'rend','',9,'2d10','or'),a(1,'lightning-breath','','','','')],
    [t('Stormblood','immune lightning'),t('Lightning Breath','line double-near DC15 DEX 4d8'),t('Mirage','1/day 3 illusions')],'shadowdark,core'),

  m('Dragon Fire',17,18,80,'double-near (fly)','chaotic',6,5,4,4,4,5,
    [a(4,'rend','',11,'2d12','or'),a(1,'fire-breath','','','','')],
    [t('Fireblood','immune fire'),t('Fire Breath','double-near cube DC15 DEX 6d10')],'shadowdark,core','legendary'),

  m('Dragon Forest',12,16,58,'double-near (fly)','neutral',4,3,4,3,3,4,
    [a(3,'rend','',8,'2d8','or'),a(1,'poison-breath','','','','')],
    [t('Animate Plants','1/day vines DC15 DEX immobilize'),t('Poison Breath','near cube DC15 CON 3d8')],'shadowdark,core'),

  m('Dragon Frost',14,17,68,'double-near (fly)','neutral',4,3,5,3,4,3,
    [a(4,'rend','',9,'2d10','or'),a(1,'ice-breath','','','','')],
    [t('Frostblood','immune cold'),t('Ice Breath','double-near cube DC15 DEX 4d8+frozen 1 rd')],'shadowdark,core'),

  m('Dragon Sea',16,17,76,'double-near (fly/swim)','lawful',5,6,4,4,5,5,
    [a(4,'rend','',10,'2d10','or'),a(1,'steam-breath','','','','or'),a(1,'water-spout','','','','')],
    [t('Steam Breath','double-near cube DC15 DEX 4d12'),t('Water Spout','near cube far DC15 STR flung 2d100ft')],'shadowdark,core','legendary'),

  m('Dragon Swamp',12,16,58,'double-near (burrow/swim)','chaotic',5,3,4,4,3,3,
    [a(3,'rend','',8,'2d10','or'),a(1,'smog-breath','','','','')],
    [t('Smog Breath','near cube DC15 CON 2d10+blinded 1 rd')],'shadowdark,core'),

  m('Drow',2,16,9,'near','chaotic',0,3,0,1,1,1,
    [a(1,'poison-dart','near',3,'1d4','or'),a(1,'longsword','',1,'1d8','')],
    [t('Poison','DC15 CON sleep'),t('Sunblind','disadvantage in sunlight')],'shadowdark,core'),

  m('Drow Drider',6,16,29,'near (climb)','chaotic',3,3,2,2,2,0,
    [a(3,'longsword','',3,'1d8','or'),a(2,'longbow','far',3,'1d8','')],
    [t('Poison','DC15 CON paralyzed 1d4 rds'),t('Sunblind','disadvantage in sunlight')],'shadowdark,core'),

  m('Drow Priestess',6,16,28,'near','chaotic',2,3,1,3,4,3,
    [a(3,'snake-whip','near',4,'1d8','or'),a(1,'spell','',4,'','')],
    [t('Poison','on hit'),t('Sunblind','disadvantage in sunlight'),t('Snuff','WIS extinguish all light near'),t('Summon Spiders','WIS 2d4 spiders 5 rds'),t('Web','WIS near cube DC15 STR escape')],'shadowdark,core'),

  m('Druid',7,11,31,'near','neutral',0,1,0,4,3,0,
    [a(1,'staff','',0,'1d4','or'),a(2,'spell','',5,'','')],
    [t('Barkskin','INT AC15'),t('Conjure Flames','INT 2d6'),t('Imbue','INT +3 weapon 5 rds'),t('Summon Bear','INT brown bear 5 rds'),t('Thunderclap','INT near cube throw 2d20ft')],'shadowdark,core'),

  m('Dryad',4,13,19,'near','neutral',-1,2,1,1,3,4,
    [a(1,'staff','',-1,'1d4','or'),a(1,'charm','','','','')],
    [t('Charm','DC14 CHA near 1d8 days'),t('Meld','merge with bonded tree')],'shadowdark,core'),

  m('Duergar',2,15,12,'near','chaotic',2,0,3,0,-1,-1,
    [a(1,'war-pick','',2,'1d6','')],
    [t('Enlarge','1/day +1d6 melee 3 rds'),t('Invisibility','1/day 3 rds'),t('Sunblind','disadvantage in sunlight')],'shadowdark,core'),

  m('Dung Beetle Giant',2,13,10,'near','neutral',1,-1,1,-3,-1,-3,
    [a(1,'horn','',1,'1d4','')],
    [t('Knock','DC9 STR or pushed close+prone')],'shadowdark,core'),

  m('Efreeti',9,15,43,'near (fly)','chaotic',5,2,3,3,2,3,
    [a(3,'scimitar','',8,'2d10','or'),a(2,'fire-bolt','far',5,'2d6','')],
    [t('Impervious','immune fire/magical'),t('Wall of Flame','1/day 20ft curtain double-near 4d8'),t('Wish','1/wk')],'shadowdark,core'),

  m('Elemental Air Lesser',6,16,29,'double-near (fly)','neutral',1,5,2,-2,1,-2,
    [a(3,'slam','',7,'2d6','or'),a(1,'whirlwind','','','','')],
    [t('Impervious','immune magical'),t('Whirlwind','close DC15 DEX flung 2d20ft')],'shadowdark,core'),

  m('Elemental Air Greater',9,16,42,'double-near (fly)','neutral',1,5,2,-2,1,-2,
    [a(3,'slam','',7,'3d6','or'),a(1,'whirlwind','','','','')],
    [t('Impervious','immune magical'),t('Whirlwind','close DC15 DEX flung 2d20ft')],'shadowdark,core'),

  m('Elemental Earth Lesser',6,17,31,'near (burrow)','neutral',5,0,4,-2,1,-2,
    [a(3,'slam','',7,'2d8','or'),a(1,'avalanche','','','','')],
    [t('Impervious','immune magical'),t('Avalanche','close DC15 STR entombed 1d4 rds')],'shadowdark,core'),

  m('Elemental Earth Greater',9,17,44,'near (burrow)','neutral',5,0,4,-2,1,-2,
    [a(3,'slam','',7,'3d8','or'),a(1,'avalanche','','','','')],
    [t('Impervious','immune magical'),t('Avalanche','close DC15 STR entombed 1d4 rds')],'shadowdark,core'),

  m('Elemental Fire Lesser',6,15,30,'near (fly)','neutral',4,3,3,-2,1,-2,
    [a(3,'slam','',6,'2d10','or'),a(1,'inferno','','','','')],
    [t('Impervious','immune fire/magical'),t('Inferno','near DC15 DEX 3d8')],'shadowdark,core'),

  m('Elemental Fire Greater',9,15,43,'near (fly)','neutral',4,3,3,-2,1,-2,
    [a(3,'slam','',6,'3d10','or'),a(1,'inferno','','','','')],
    [t('Impervious','immune fire/magical'),t('Inferno','near DC15 DEX 3d8')],'shadowdark,core'),

  m('Elemental Water Lesser',6,15,29,'double-near (swim)','neutral',4,2,2,-2,1,-2,
    [a(3,'slam','',6,'2d6','or'),a(1,'whirlpool','','','','')],
    [t('Impervious','immune magical'),t('Whirlpool','close DC15 STR immobilized inside')],'shadowdark,core'),

  m('Elemental Water Greater',9,15,42,'double-near (swim)','neutral',4,2,2,-2,1,-2,
    [a(3,'slam','',6,'3d6','or'),a(1,'whirlpool','','','','')],
    [t('Impervious','immune magical'),t('Whirlpool','close DC15 STR immobilized inside')],'shadowdark,core'),

  m('Elephant',7,14,34,'near','neutral',5,0,3,-2,1,0,
    [a(2,'tusks','',6,'1d8','')],
    [t('Charge','move double-near in line; triple dmg on hit')],'shadowdark,core'),

  m('Elf',2,13,9,'near','lawful',0,3,0,1,1,1,
    [a(1,'longbow','far',3,'1d8','or'),a(1,'longsword','',1,'1d8','')],
    [t('Feyblood','immune sleep/charm')],'shadowdark,core'),

  m('Ettercap',3,12,14,'near (climb)','chaotic',0,2,1,0,0,-1,
    [a(2,'bite','',2,'1d6','or'),a(1,'poison-web','near',2,'','')],
    [t('Poison Web','stuck; DC12 DEX escape; 1d4 dmg/rd')],'shadowdark,core'),

  m('Fairy',1,13,4,'near (fly)','neutral',-2,3,0,1,0,1,
    [a(1,'needle','',3,'1','')],
    [t('Poison','DC12 CON sleep 1d4 hrs')],'shadowdark,core'),

  m('Frog Giant',2,12,10,'near (swim)','neutral',2,2,1,-3,0,-3,
    [a(1,'tongue','','','','and'),a(1,'bite','',2,'1d6','')],
    [t('Tongue','near DC12 DEX pull to close')],'shadowdark,core'),

  m('Gargoyle',4,16,20,'near (fly)','chaotic',3,1,2,0,1,-1,
    [a(2,'claw','',3,'1d6','')],
    [t('Impervious','immune to non-magical weapons')],'shadowdark,core'),

  m('Gelatinous Cube',5,11,24,'near','neutral',1,1,2,-4,1,-4,
    [a(1,'touch','',4,'1d8','')],
    [t('Engulf','DC12 STR or trapped; auto-hit'),t('Rubbery','half stab dmg'),t('Toxin','DC15 CON paralyzed')],'shadowdark,core'),

  m('Ghast',4,11,20,'near','chaotic',3,1,1,2,0,2,
    [a(2,'claw','',4,'1d8','')],
    [t('Undead','immune sleep/charm/morale'),t('Carrion Stench','DC12 CON disadvantage 5 rds'),t('Paralyze','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Ghost',6,13,27,'near (fly)','chaotic',-2,3,0,0,0,4,
    [a(2,'death-touch','',5,'1d6','or'),a(1,'possess','','','','')],
    [t('Greater Undead','immune non-magical'),t('Incorporeal','half from non-magical'),t('Life Drain','1d4 CON dmg'),t('Possess','contested CHA; inhabit 2d4 rds')],'shadowdark,core'),

  m('Ghoul',2,11,11,'near','chaotic',2,1,2,-3,-1,0,
    [a(1,'claw','',2,'1d6','')],
    [t('Undead','immune sleep/charm/morale'),t('Paralyze','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Giant Cloud',10,15,48,'double-near','neutral',5,4,3,3,3,3,
    [a(3,'morningstar','',9,'2d10','')],
    [t('Alert',"can't be surprised")],'shadowdark,core'),

  m('Giant Fire',9,15,44,'double-near','chaotic',6,0,4,1,2,1,
    [a(3,'greatsword','',9,'2d12','')],
    [t('Fireblood','immune fire')],'shadowdark,core'),

  m('Giant Frost',9,14,44,'double-near','chaotic',5,1,4,2,3,2,
    [a(3,'greataxe','',8,'2d10','')],
    [t('Frostblood','immune cold')],'shadowdark,core'),

  m('Giant Goat',8,12,39,'double-near (climb)','chaotic',4,1,3,-2,0,-2,
    [a(2,'greatclub','',7,'2d8','or'),a(1,'boulder','far',7,'2d10','')],
    [],'shadowdark,core'),

  m('Giant Hill',7,11,34,'double-near','chaotic',4,0,3,-2,-2,-2,
    [a(2,'greatclub','',6,'2d8','or'),a(1,'boulder','far',6,'2d10','')],
    [],'shadowdark,core'),

  m('Giant Stone',8,17,40,'double-near','neutral',4,2,4,1,1,-1,
    [a(2,'greatclub','',7,'2d8','or'),a(1,'boulder','far',7,'2d10','')],
    [t('Stone Hide','half dmg from stab/cut')],'shadowdark,core'),

  m('Giant Storm',12,15,58,'double-near (swim)','lawful',6,2,4,3,4,4,
    [a(3,'greatsword','',10,'2d12','or'),a(1,'lightning-bolt','','','','')],
    [t('Stormblood','immune lightning'),t('Lightning Bolt','3/day line far DC15 DEX 5d10')],'shadowdark,core'),

  m('Gibbering Mouther',4,8,21,'near (climb/swim)','neutral',2,-2,3,-3,0,-3,
    [a(2,'bite','',3,'1d8','')],
    [t('Gibbering','DC12 WIS or random action'),t('Latch','auto-hit; DC12 STR to remove')],'shadowdark,core'),

  m('Gladiator',3,16,15,'near','neutral',2,1,2,0,0,1,
    [a(2,'longsword','',3,'1d8','or'),a(1,'spear','close/near',3,'1d6','')],
    [],'shadowdark,core'),

  m('Gnoll',2,12,10,'near','chaotic',1,1,1,-1,0,-1,
    [a(1,'spear','close/near',1,'1d6','or'),a(1,'longbow','far',1,'1d8','')],
    [t('Rage','when injured +1 atk next turn')],'shadowdark,core'),

  m('Gnome Deep',3,14,14,'near','lawful',2,1,1,1,1,1,
    [a(1,'pick','',3,'1d6','or'),a(1,'dart','near',2,'1d4','')],
    [t('Stone Meld','2/day invisible 3 rds underground')],'shadowdark,core'),

  m('Goblin',1,11,5,'near','chaotic',0,1,1,-1,-1,-2,
    [a(1,'club','',0,'1d4','or'),a(1,'shortbow','far',1,'1d4','')],
    [t('Keen Senses',"can't be surprised")],'shadowdark,core'),

  m('Goblin Boss',4,14,20,'near','chaotic',2,1,2,-1,0,1,
    [a(1,'spear','close/near',3,'1d6','')],
    [t('Keen Senses',"can't be surprised")],'shadowdark,core'),

  m('Goblin Shaman',4,12,19,'near','chaotic',0,1,1,0,2,1,
    [a(1,'staff','',0,'1d4','or'),a(1,'spell','',3,'','')],
    [t('Keen Senses',"can't be surprised"),t('Bug Brain','WIS DC13 INT→1 1d4 rds'),t('Skitter','WIS DC12 climb like spider'),t('Stink Bomb','WIS DC12 2d4+disadvantage')],'shadowdark,core'),

  m('Golem Clay',8,14,40,'near','neutral',4,0,4,-2,0,-2,
    [a(3,'slam','',6,'1d8','')],
    [t('Golem','immune fire/cold/elec/non-magic; healed by acid'),t('Curse','dmg only healed by LV5+ priest')],'shadowdark,core'),

  m('Golem Flesh',7,9,35,'near','neutral',4,-1,4,-1,1,-3,
    [a(3,'slam','',6,'1d8','')],
    [t('Golem','immune fire/cold/non-magic; healed by elec'),t('Berserk','≤20 HP +1 atk double dmg')],'shadowdark,core'),

  m('Golem Iron',10,19,49,'near','neutral',5,-1,4,-2,0,-2,
    [a(3,'slam','',8,'2d8','')],
    [t('Golem','immune cold/non-magic; healed by fire'),t('Poison Breath','near DC15 CON 8d6')],'shadowdark,core'),

  m('Golem Stone',8,18,40,'near','neutral',4,-1,4,-2,0,-2,
    [a(3,'slam','',6,'1d8','')],
    [t('Golem','immune fire/cold/elec/non-magic'),t('Slow','far DC15 CON half speed')],'shadowdark,core'),

  m('Gorgon',7,18,33,'double-near','chaotic',4,0,2,-3,1,-3,
    [a(2,'gore','',6,'2d8','or'),a(1,'charge','','','','or'),a(1,'petrifying-breath','','','','')],
    [t('Charge','triple dmg'),t('Petrifying Breath','near cube DC15 CON petrified')],'shadowdark,core'),

  m('Gorilla',4,12,20,'near (climb)','neutral',4,2,2,-1,1,-1,
    [a(2,'rend','',5,'2d6','')],
    [],'shadowdark,core'),

  m('Gray Ooze',2,11,9,'near (climb)','neutral',1,1,0,-4,-3,-4,
    [a(1,'tentacle','',2,'1d6','')],
    [t('Impervious','immune acid/cold/fire'),t('Corrosive','metal dissolves 1-3 on d6')],'shadowdark,core'),

  m('Grick',4,14,19,'near (climb)','neutral',3,2,1,-3,1,-3,
    [a(1,'beak','',3,'1d8','and'),a(1,'tentacle','',3,'1d6','')],
    [t('Camouflage','surprise on 1-3'),t('Grab','DC15 STR or immobilized')],'shadowdark,core'),

  m('Griffon',4,12,19,'double-near (fly)','neutral',4,2,1,-3,1,-1,
    [a(2,'rend','',4,'1d10','')],
    [],'shadowdark,core'),

  m('Grimlow',9,12,43,'near','neutral',4,2,3,-3,1,-2,
    [a(1,'grab','','','','and'),a(3,'bite','',6,'2d8','')],
    [t('Grab','DC15 STR or immobilized; auto-hit subsequent turns')],'shadowdark,core'),

  m('Guard',1,15,4,'near','lawful',1,0,0,0,1,0,
    [a(1,'spear','close/near',1,'1d6','or'),a(1,'longsword','',1,'1d8','')],
    [],'shadowdark,core'),

  m('Hag Night',8,14,37,'near','chaotic',4,2,1,2,3,3,
    [a(2,'bite','',6,'1d10','and'),a(1,'blind','','','','')],
    [t('Blind','DC15 CHA 1d4 days'),t('Shapechange','any humanoid')],'shadowdark,core'),

  m('Hag Sea',6,15,28,'near (swim)','chaotic',2,3,1,1,2,2,
    [a(2,'claw','',4,'1d8','')],
    [t('Shapechange','any humanoid'),t('Terrify','DC15 CHA disadvantage 1d4 rds')],'shadowdark,core'),

  m('Hag Weald',6,14,28,'near','chaotic',3,2,1,1,2,3,
    [a(2,'claw','',4,'1d8','or'),a(1,'drink-pain','','','','')],
    [t('Drink Pain','DC12 CHA near 2d4 dmg; hag regains HP'),t('Shapechange','any humanoid')],'shadowdark,core'),

  m('Harpy',3,13,14,'near (fly)','chaotic',1,3,1,0,0,1,
    [a(2,'claw','',3,'1d6','or'),a(1,'song','','','','')],
    [t('Song','DC12 CHA double-near dazed and drawn 1d4 rds')],'shadowdark,core'),

  m('Hell Hound',4,13,19,'double-near','chaotic',2,1,1,-2,1,-3,
    [a(2,'bite','',4,'1d8','or'),a(1,'fire-breath','','','','')],
    [t('Impervious','immune fire'),t('Fire Breath','near cube DC15 DEX 3d8')],'shadowdark,core'),

  m('Hippogriff',3,13,14,'double-near (fly)','neutral',3,3,1,-3,1,-2,
    [a(2,'rend','',3,'1d8','')],
    [],'shadowdark,core'),

  m('Hippopotamus',5,12,24,'near (swim)','neutral',4,0,2,-3,0,-3,
    [a(2,'bite','',4,'1d10','')],
    [t('Stumpy','advantage on grab/drag')],'shadowdark,core'),

  m('Hobgoblin',2,15,10,'near','chaotic',3,0,1,2,1,1,
    [a(1,'longsword','',3,'1d8','or'),a(1,'longbow','far',0,'1d8','')],
    [t('Phalanx','+1 atk and AC per adjacent allied hobgoblin')],'shadowdark,core'),

  m('Horse',2,11,11,'double-near','neutral',3,1,2,-3,1,-2,
    [a(1,'hooves','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Hydra',5,15,25,'near (swim)','neutral',5,1,2,-2,1,-2,
    [a(1,'bite','near',6,'1d8','')],
    [t('Heads','each head LV2 HP11; killed head sprouts 2 unless cauterized')],'shadowdark,core'),

  m('Invisible Stalker',6,13,29,'near (fly)','neutral',2,3,2,2,1,0,
    [a(3,'pummel','',4,'1d6','')],
    [t('Bound','secret contingency ends servitude'),t('Invisible','naturally invisible'),t('Tracking','always senses quarry')],'shadowdark,core'),

  m('Jellyfish',0,11,1,'close (swim)','neutral',-4,1,0,-4,1,-4,
    [a(1,'sting','',1,'1','')],
    [t('Toxin','DC9 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Knight',3,17,14,'near','lawful',3,0,1,0,0,1,
    [a(2,'bastard-sword','',3,'1d8','')],
    [t('Oath','3/day advantage in service of order')],'shadowdark,core'),

  m('Kobold',0,13,1,'near','chaotic',-2,2,0,-1,0,-1,
    [a(1,'spear','close/near',0,'1d6','')],
    [t('Dodge','1/day turn miss into near-miss')],'shadowdark,core'),

  m('Kobold Sorcerer',3,13,13,'near','chaotic',-2,2,0,-1,1,2,
    [a(1,'club','',1,'1d4','or'),a(1,'spell','',2,'','')],
    [t('Dodge','1/day'),t('Scorpion Sting','CHA DC11 1d6+disadvantage'),t('Spider Swarm','CHA DC12 spider swarm 1d4 rds')],'shadowdark,core'),

  m('Kraken',17,18,80,'double-near (swim)','chaotic',6,4,4,4,3,4,
    [a(4,'tentacle','near',9,'2d12','or'),a(1,'storm','','','','or'),a(1,'lightning-bolt','','','','')],
    [t('Impervious','immune lightning'),t('Crush','double dmg vs objects'),t('Lightning Bolt','line far DC15 DEX 6d6'),t('Storm','1mi radius chaos; 1-in-6 capsize')],'shadowdark,core','legendary'),

  m('Leech Giant',2,9,10,'near (swim)','neutral',1,-1,1,-3,-1,-3,
    [a(1,'bite','',1,'1d4','')],
    [t('Attach','auto-hit next rd; DC12 STR to remove')],'shadowdark,core'),

  m('Leprechaun',4,13,19,'near','neutral',1,3,1,2,1,3,
    [a(1,'spell','',4,'','')],
    [t('Alert',"can't be surprised"),t('Slippery','hostile spells DC15'),t("Fool's Gold",'CHA DC12'),t('Illusion','CHA DC11'),t('Invisibility','CHA DC12')],'shadowdark,core'),

  m('Lich',13,16,62,'near','chaotic',3,1,4,4,3,3,
    [a(2,'touch','',6,'2d8','and'),a(2,'spell','',7,'','')],
    [t('Supreme Undead','immune non-magical/morale'),t('Phylactery','reforms 1d4 days'),t('Paralysis','DC15 CON 1d4 rds'),t('Flight','fly near'),t('Null','cancel spells near'),t('Shadow Leap','teleport darkness to darkness'),t('Sigil of Doom','rune 4d8 on trigger'),t('Wither','DC15 CON max HP halved')],'shadowdark,core'),

  m('Lion',3,12,15,'near','neutral',4,2,2,-3,1,-3,
    [a(2,'rend','',4,'1d8','')],
    [],'shadowdark,core'),

  m('Lizardfolk',2,14,11,'near (swim)','chaotic',1,1,2,-1,1,-2,
    [a(1,'spear','close/near',2,'1d6','')],
    [],'shadowdark,core'),

  m('Mage',6,11,27,'near','lawful',-1,1,0,3,1,0,
    [a(1,'spell','',5,'','')],
    [t('Arcane Armor','INT AC16 2d4 rds'),t('Blast','INT 2d6 far'),t('Cancel','INT end spell'),t('Levitate','INT near hover'),t('Snare','INT DC13 paralyzed')],'shadowdark,core'),

  m('Mammoth',9,15,44,'near','neutral',5,0,4,-2,1,0,
    [a(2,'tusks','',7,'1d12','')],
    [t('Thick Fur','immune cold'),t('Charge','double-near line triple dmg')],'shadowdark,core'),

  m('Manta Ray Giant',8,13,37,'double-near (swim)','neutral',3,3,1,-2,1,-3,
    [a(2,'sting','',5,'1d12','')],
    [t('Poison','DC15 CON 0 HP in 1d4 rds')],'shadowdark,core'),

  m('Manticore',6,14,29,'double-near (fly)','chaotic',4,2,2,-2,1,-2,
    [a(2,'rend','',6,'2d6','or'),a(2,'tail-spike','far',4,'1d8','')],
    [t('Spikes','4d6 total spikes; regrow daily')],'shadowdark,core'),

  m('Mastiff',1,11,4,'near','neutral',1,1,0,-2,1,-2,
    [a(1,'bite','',1,'1d6','')],
    [],'shadowdark,core'),

  m('Medusa',8,14,38,'near','chaotic',2,1,2,2,3,4,
    [a(1,'snake-bite','',6,'1d6','')],
    [t('Godborn','hostile spells DC15'),t('Petrify','DC15 CON on gaze'),t('Poison','DC15 CON 0 HP')],'shadowdark,core'),

  m('Merfolk',2,11,9,'near (swim)','lawful',1,1,0,0,1,1,
    [a(1,'spear','close/near',2,'1d6','')],
    [],'shadowdark,core'),

  m('Mimic',5,12,23,'near','neutral',2,0,1,-2,0,-3,
    [a(2,'bite','',5,'1d8','')],
    [t('Stick','DC15 STR or adhered; auto-hit')],'shadowdark,core'),

  m('Minotaur',7,14,34,'near','chaotic',4,1,3,1,2,1,
    [a(2,'greataxe','',6,'1d10','and'),a(1,'horns','',6,'1d12','')],
    [t('Charge','double-near double dmg')],'shadowdark,core'),

  m('Moose',4,11,19,'double-near','neutral',3,0,1,-2,0,-2,
    [a(2,'antler','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Mordanticus the Flayed',19,17,89,'near','neutral',4,4,4,5,4,5,
    [a(1,'rot-touch','',8,'1d10','and'),a(3,'spell','',8,'','')],
    [t('Legendary Undead','magical only DC18'),t('Crown of Gehemna','3/day counter spell far'),t('Necrosis','DC15 CON 0 HP blocks all healing'),t('Phylactery','reforms 2d6 days'),t('Absorb','steal spell slot'),t('Banish','send to void'),t('Bind','paralyze target'),t('Blast','INT 5d8'),t('Phase','become ethereal'),t('True Name','instakill if known')],'shadowdark,core','legendary'),

  m('Mummy',10,13,47,'near','chaotic',3,0,2,3,2,3,
    [a(3,'rot-touch','',8,'1d10','')],
    [t('Supreme Undead','immune non-magical'),t('Desiccated','double dmg from fire'),t('Necrosis','DC15 CON 0 HP; blocks all healing')],'shadowdark,core'),

  m('Mushroomfolk',3,13,15,'near','neutral',2,-1,2,0,1,0,
    [a(2,'slam','',2,'1d6','')],
    [t('Sunblind','disadvantage in sunlight'),t('Telepathic','communicate double-near')],'shadowdark,core'),

  m('Naga',9,16,43,'near (climb)','chaotic',4,1,3,2,2,4,
    [a(2,'bite','',7,'2d6','and'),a(1,'spell','',7,'','')],
    [t('Poison','DC15 CON paralyzed 1d4 rds'),t('Agony','CHA 3d8'),t('Hypnotize','CHA DC13 stupefied'),t('Whispers','CHA DC12 enemy spells DC9')],'shadowdark,core'),

  m('Naga Bone',6,13,31,'near (burrow/climb)','chaotic',3,2,4,-3,0,4,
    [a(2,'bite','',5,'2d6','')],
    [t('Greater Undead','immune non-magical/morale')],'shadowdark,core'),

  m('Nightmare',6,13,29,'double-near (fly)','chaotic',3,3,2,-1,1,-2,
    [a(2,'hooves','',5,'1d8','')],
    [t('Impervious','immune fire; rider also immune')],'shadowdark,core'),

  m('Obe-Ixx of Azarumme',16,18,76,'near (climb/fly)','chaotic',5,3,4,3,4,5,
    [a(4,'greatsword','near',11,'1d12+2','and'),a(1,'bite','',9,'1d8','and'),a(1,'charm','','','','')],
    [t('Legendary Undead','magical only DC18'),t('Blood Drain','2d8 healed; 1d6 CON loss'),t('Charm','DC15 CHA 1d4 days'),t('Dire Shapechange','bat/wolf/mist/humanoid'),t('Moonbite Properties','silver weakness'),t('Ur-Vampire','sire of vampires')],'shadowdark,core','legendary'),

  m('Ochre Jelly',4,9,20,'near (climb)','neutral',2,-1,2,-4,-3,-4,
    [a(2,'tentacle','',3,'1d6','')],
    [t('Split','cut = 2 oozes; up to 4 times')],'shadowdark,core'),

  m('Octopus Giant',5,13,23,'near (swim)','neutral',3,3,1,-2,1,-3,
    [a(2,'tentacle','near',4,'1d8','')],
    [t('Grab','DC15 STR'),t('Ink','blind near 1d4 rds')],'shadowdark,core'),

  m('Ogre',6,9,30,'near','chaotic',4,-1,3,-2,-2,-2,
    [a(2,'greatclub','',6,'2d6','')],
    [],'shadowdark,core'),

  m('Oni',7,11,33,'near','chaotic',5,1,2,2,1,3,
    [a(1,'glaive','near',6,'1d10','or'),a(1,'spell','',5,'','')],
    [t('Shapeshift','humanoid form'),t('Fade','CHA invisible 1d4 rds'),t('Hellfrost','CHA near cube 3d6'),t('Mist','CHA fly double-near 2d4 rds')],'shadowdark,core'),

  m('Orc',1,15,4,'near','chaotic',2,0,0,-1,0,-1,
    [a(1,'greataxe','',2,'1d8','')],
    [t('Rage','when injured +1 atk')],'shadowdark,core'),

  m('Orc Chieftain',4,14,19,'near','chaotic',2,1,-1,0,0,-1,
    [a(2,'greataxe','',4,'1d10','')],
    [t('Rage','when injured +1 atk')],'shadowdark,core'),

  m('Otyugh',7,13,35,'near','neutral',4,-1,4,-2,0,-3,
    [a(2,'tentacle','',5,'1d8','and'),a(1,'bite','',5,'1d10','')],
    [t('Disease','DC15 CON 1d6 HP/day; cannot heal')],'shadowdark,core'),

  m('Primordial Slime',6,9,30,'near (climb)','chaotic',3,2,3,-4,-3,-4,
    [a(2,'tentacle','',4,'1d10','')],
    [t('Impervious','immune fire only'),t('Dissolve','destroy 1 gear piece on hit')],'shadowdark,core'),

  m('Rime Walker',9,16,43,'near (fly)','chaotic',4,4,3,2,2,2,
    [a(4,'claw','',8,'1d12','')],
    [t('Impervious','immune cold'),t('Ice Aura','near DC12 CON or lose action')],'shadowdark,core'),

  m('Void Spawn',7,13,34,'near (fly)','chaotic',4,1,3,0,1,-1,
    [a(2,'scythe','',6,'1d10','and'),a(1,'tentacles','',6,'1d12','')],
    [t('Impervious','immune cold'),t('Toxin','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Void Spider',5,13,23,'near (climb)','chaotic',3,3,1,-1,1,-2,
    [a(2,'bite','',4,'1d8','')],
    [t('Impervious','immune cold'),t('Phase','corporeal/incorporeal toggle 1/rd'),t('Poison','DC12 CON 0 HP in 1d4 rds')],'shadowdark,core'),

  m('Owlbear',6,13,30,'near (climb)','neutral',4,1,3,-2,2,-3,
    [a(2,'claw','',5,'1d10','')],
    [t('Crush','extra die when both claws hit')],'shadowdark,core'),

  m('Panther',3,14,14,'near (climb)','neutral',3,4,1,-2,1,-3,
    [a(2,'rend','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Peasant',1,10,4,'near','lawful',0,0,0,0,0,0,
    [a(1,'club','',0,'1d4','')],
    [],'shadowdark,core'),

  m('Pegasus',3,12,15,'double-near (fly)','neutral',3,2,2,-3,1,0,
    [a(2,'hooves','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Phoenix',13,16,60,'double-near (fly)','lawful',3,4,2,3,3,3,
    [a(4,'rend','',8,'2d12','')],
    [t('Impervious','immune fire/magical'),t('Explosion','death DC18 DEX double-near 10d6'),t('Heat Aura','near DC15 CON 2d6/turn'),t('Rebirth','egg hatches 1d4 days')],'shadowdark,core'),

  m('Piranha Swarm',3,12,13,'near (swim)','neutral',-2,2,0,-3,0,-3,
    [a(2,'bite','',2,'1d6','')],
    [t('Savage','advantage vs targets below half HP')],'shadowdark,core'),

  m('Pirate',1,12,4,'near','chaotic',1,1,0,0,0,0,
    [a(1,'cutlass','',1,'1d6','or'),a(1,'dagger','close/near',1,'1d4','')],
    [],'shadowdark,core'),

  m('Priest',5,15,23,'near','lawful',1,0,1,0,2,1,
    [a(2,'mace','',3,'1d6','or'),a(1,'spell','',3,'','')],
    [t('Anoint','WIS +2 weapon/armor 10 rds'),t('Healing Touch','WIS 2d4 HP'),t('Holy Flame','WIS +1d6 fire 5 rds'),t('Rebuke','WIS focus C can\'t attack/approach')],'shadowdark,core'),

  m('Purple Worm',12,18,57,'double-near (burrow)','neutral',5,1,3,-3,1,-3,
    [a(2,'bite','',9,'2d12','and'),a(1,'sting','',9,'1d10','')],
    [t('Poison','DC15 CON 0 HP'),t('Swallow','natural 18-20; 2d10/rd inside; DC20 STR to regurgitate')],'shadowdark,core'),

  m('Rakshasa',8,16,39,'near','chaotic',1,3,3,3,3,4,
    [a(2,'claw','',6,'1d8','')],
    [t('Impervious','immune spells tier 3 or lower'),t('Mesmerism','read minds; shapechange humanoid'),t('Weakness','holy crossbow bolt kills instantly')],'shadowdark,core'),

  m('Rat',0,10,1,'near','neutral',-3,0,1,-3,0,-3,
    [a(1,'bite','',0,'1','')],
    [t('Disease','DC9 CON 1d4 CON dmg/day')],'shadowdark,core'),

  m('Rat Dire',2,12,10,'near','neutral',1,2,1,-2,0,-2,
    [a(1,'bite','',2,'1d6','')],
    [t('Disease','DC12 CON')],'shadowdark,core'),

  m('Rat Giant',1,11,5,'near','neutral',-2,1,1,-2,1,-2,
    [a(1,'bite','',1,'1d4','')],
    [t('Disease','DC12 CON')],'shadowdark,core'),

  m('Rat Swarm',6,10,28,'near','neutral',-3,0,1,-3,1,-3,
    [a(4,'bite','',0,'1','')],
    [t('Disease','DC9 CON')],'shadowdark,core'),

  m('Rathgamnon',19,17,89,'double-near (fly)','lawful',5,3,4,5,6,5,
    [a(2,'rend','near',9,'2d10','and'),a(2,'spell','',8,'','')],
    [t('Legendary','magical only DC18'),t('Roar','far DC18 CHA blind+speechless 1d4 days'),t('Abjure','INT end effects'),t('Abolish','INT destroy creature'),t('Anchor','INT fix in space'),t('Gate','INT open dimensional gate'),t('Portent','INT foresee next turn'),t('Time Stop','INT halt all others 1d4 rds')],'shadowdark,core','legendary'),

  m('Reaver',6,17,28,'near','chaotic',3,0,1,0,0,2,
    [a(3,'bastard-sword','',4,'1d8+2','')],
    [t('Bloodlust','+2 melee dmg included')],'shadowdark,core'),

  m('Remorhaz',10,16,47,'near (burrow)','neutral',5,1,2,-3,1,-3,
    [a(3,'bite','',7,'2d6','')],
    [t('Impervious','immune cold/fire'),t('Melt','metal dissolves 1-3 on d6'),t('Swallow','natural 18-20; 2d10/rd; DC20 to regurgitate')],'shadowdark,core'),

  m('Rhinoceros',5,14,25,'near','neutral',4,-1,3,-3,0,-3,
    [a(2,'horn','',4,'1d8','')],
    [t('Charge','double-near line; triple dmg')],'shadowdark,core'),

  m('Roc',15,15,69,'double-near (fly)','neutral',5,3,2,-2,2,-2,
    [a(4,'rend','',9,'2d10','')],
    [t('Grab','DC18 STR')],'shadowdark,core'),

  m('Roper',6,14,31,'close (climb)','neutral',3,-2,4,-1,2,1,
    [a(4,'tendril','double-near',4,'1d6','and'),a(1,'bite','',4,'2d8','')],
    [t('Impervious','immune magical'),t('Grab','DC15 STR'),t('Pull','drag grabbed to near'),t('Tendrils','4 total AC18; 4+ dmg severs')],'shadowdark,core'),

  m('Rot Flower',2,9,10,'none','neutral',1,-3,1,-4,-3,-4,
    [a(1,'bite','',1,'1d4','')],
    [t('Toxin','DC12 CON unconscious 1d4 rds')],'shadowdark,core'),

  m('Rust Monster',4,13,19,'near (climb)','neutral',2,3,1,-3,1,-3,
    [a(2,'claw','',3,'1d6','')],
    [t('Corrosive','metal destroyed 1-3 on d6')],'shadowdark,core'),

  m('Sahuagin',2,14,9,'near (swim)','chaotic',1,1,0,0,1,-1,
    [a(2,'trident','near',1,'1d6','')],
    [t('Half-Amphibious','submerge 4hrs or suffocate')],'shadowdark,core'),

  m('Salamander',5,13,24,'near','chaotic',2,0,2,-1,1,-1,
    [a(2,'flaming-spear','close/near',4,'1d6','or'),a(1,'iron-longbow','far',2,'1d8','')],
    [t('Impervious','immune fire'),t('Heat Aura','close DC12 CON 1d8/turn')],'shadowdark,core'),

  m('Scarab Swarm',3,13,14,'near (fly)','neutral',-1,3,1,-3,1,-3,
    [a(2,'bite','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Scarecrow',3,12,15,'near','chaotic',2,2,2,0,0,2,
    [a(2,'claws','',2,'1d6','or'),a(1,'scream','','','','')],
    [t('Scream','double-near DC12 CHA paralyzed 1d4 rds')],'shadowdark,core'),

  m('Scorpion',0,11,1,'near (climb)','neutral',-4,1,0,-4,0,-4,
    [a(1,'sting','',1,'1','')],
    [t('Poison','DC9 CON 0 HP')],'shadowdark,core'),

  m('Scorpion Giant',3,14,13,'near (climb)','neutral',2,2,0,-4,0,-4,
    [a(1,'claw','',2,'1d6','and'),a(1,'sting','',2,'1d4','')],
    [t('Grab','DC12 STR'),t('Poison','DC12 CON 0 HP')],'shadowdark,core'),

  m('Shadow',3,12,15,'near (fly)','chaotic',-4,2,2,-2,0,-1,
    [a(2,'touch','',2,'1d4','')],
    [t('Drain','1 STR dmg; 0 STR = shadow spawn')],'shadowdark,core'),

  m('Shambling Mound',4,14,20,'near','neutral',3,-2,2,-3,0,-3,
    [a(2,'slam','',3,'1d6','')],
    [t('Impervious','immune fire; healed by elec'),t('Engulf','both slams hit = pulled in; suffocate 2d4 rds; DC15 STR escape')],'shadowdark,core'),

  m('Shark',3,11,15,'near (swim)','neutral',3,1,2,-3,1,-3,
    [a(1,'bite','',3,'1d10','')],
    [],'shadowdark,core'),

  m('Shark Megalodon',8,13,38,'double-near (swim)','neutral',5,1,2,-3,1,-3,
    [a(3,'bite','',7,'2d8','')],
    [t('Fearless','immune morale')],'shadowdark,core'),

  m('Siren',4,12,18,'near (swim/fly)','chaotic',0,2,0,2,2,4,
    [a(2,'claw','',2,'1d6','or'),a(1,'song','','','','')],
    [t('Song','DC15 CHA double-near paralyzed 1d4 rds')],'shadowdark,core'),

  m('Skeleton',2,13,11,'near','chaotic',1,0,2,-2,0,-1,
    [a(1,'shortsword','',1,'1d6','or'),a(1,'shortbow','far',0,'1d4','')],
    [t('Undead','immune sleep/charm/morale')],'shadowdark,core'),

  m('Smilodon',3,12,14,'near','neutral',3,2,1,-3,1,-3,
    [a(2,'bite','',3,'1d6','')],
    [],'shadowdark,core'),

  m('Snake Cobra',1,12,4,'near','neutral',-3,2,0,-3,0,-3,
    [a(1,'bite','',2,'1','')],
    [t('Poison','DC18 CON 0 HP; death-timer 1')],'shadowdark,core'),

  m('Snake Giant',5,12,23,'near (climb)','neutral',3,2,1,-2,0,-2,
    [a(2,'bite','',4,'1d6','and'),a(1,'constrict','near','','','')],
    [t('Constrict','contested STR or immobile 1 rd')],'shadowdark,core'),

  m('Snake Swarm',4,12,19,'near','neutral',-3,2,1,-3,0,-3,
    [a(3,'bite','',2,'1d4','')],
    [t('Poison','DC12 CON 0 HP in 1d4 rds')],'shadowdark,core'),

  m('Soldier',2,15,10,'near','lawful',1,0,1,0,0,0,
    [a(1,'longsword','',2,'1d8','or'),a(1,'crossbow','far',1,'1d6','')],
    [],'shadowdark,core'),

  m('Sphinx',9,16,42,'double-near (fly)','lawful',4,1,2,4,4,3,
    [a(3,'claw','',7,'1d10','or'),a(2,'spell','',5,'','')],
    [t('Roar','far DC18 CHA paralyzed 1d4 rds'),t('Gate','open dimensional gate'),t('Omens','see future'),t('Riddle','bind creature to answer'),t('Time Bend','rewind moment 1/day'),t('Unmake','erase object from existence')],'shadowdark,core'),

  m('Spider',0,11,1,'near (climb)','neutral',-4,1,0,-4,0,-4,
    [a(2,'bite','',1,'1','')],
    [t('Poison','DC9 CON 1d4 dmg')],'shadowdark,core'),

  m('Spider Giant',3,13,13,'near (climb)','neutral',2,3,0,-2,1,-2,
    [a(1,'bite','',3,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 hrs')],'shadowdark,core'),

  m('Spider Swarm',2,13,9,'near (climb)','neutral',-1,3,0,-3,1,-3,
    [a(1,'bite','',3,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 rds')],'shadowdark,core'),

  m('Stingbat',1,12,4,'near (fly)','neutral',-2,2,0,-2,0,-2,
    [a(1,'beak','',2,'1d4','')],
    [t('Blood Drain','attach; auto-hit; DC9 STR to remove')],'shadowdark,core'),

  m('Strangler',3,12,14,'near (climb)','chaotic',2,2,1,-2,0,-2,
    [a(2,'claws','',2,'1d6','')],
    [t('Stealthy','surprise on 1-3'),t('Strangle','double dmg vs surprised')],'shadowdark,core'),

  m('Ten-Eyed Oracle',18,17,85,'near (fly)','chaotic',4,5,4,5,4,4,
    [a(0,'eyestalk-ray','','','','')],
    [t('Legendary','magical DC18'),t('Eyestalk Rays','10 types: Charm/Hold/Sleep/Polymorph/Cancel/Confusion/Telekinesis/Disintegrate/Petrify/Death; each DC15')],'shadowdark,core','legendary'),

  m('Tarrasque',30,22,140,'triple-near (burrow/swim)','neutral',7,2,5,-3,1,-3,
    [a(4,'thrash','near',13,'3d10','and'),a(1,'bite','near',13,'5d10','')],
    [t('Legendary','magical DC18'),t('Deep Dweller','immune mundane hazards'),t('Permanent Death','wish required at 0 HP'),t('Rampage','far line triple dmg'),t('Reflective Carapace','1-in-6 reflect'),t('Regeneration','4d10/turn'),t('Sever','natural 18+ lops limb'),t('Swallow','DC18 STR 4d10/rd; DC30 to regurgitate')],'shadowdark,core','legendary'),

  m('Wandering Merchant',15,16,71,'near','lawful',3,3,4,3,4,5,
    [a(4,'vorpal-bastard-sword','',9,'1d10','')],
    [t('Legendary','unique powers'),t('Amulet','teleport multiverse'),t('Bottomless Bag','infinite storage'),t('Dice of Truth','force honesty'),t('Lop','natural 18-20 beheads'),t('Reckoning','theft causes cockatrice transformation 2d8 days'),t('Strange Lands','knows all locations')],'shadowdark,core','legendary'),

  m('Thief',3,13,13,'near','neutral',0,2,0,0,0,1,
    [a(1,'dagger','close/near',2,'1d4','or'),a(1,'shortsword','',0,'1d6','')],
    [t('Stealthy','surprise on 1-3'),t('Backstab','double dmg vs surprised')],'shadowdark,core'),

  m('Thug',1,13,4,'near','chaotic',1,0,0,-1,1,-1,
    [a(1,'shortsword','',1,'1d6','')],
    [],'shadowdark,core'),

  m('Treant',8,14,38,'near','neutral',4,-1,2,2,3,1,
    [a(3,'slam','',8,'1d8','or'),a(1,'rock','far',8,'2d12','')],
    [t('Animate Tree','2/day near tree becomes treant ally for 1 day')],'shadowdark,core'),

  m('Troll',5,12,24,'near','chaotic',3,2,2,-1,0,-1,
    [a(2,'claw','',4,'1d6','and'),a(1,'bite','',4,'1d10','')],
    [t('Regenerate','2d6/turn unless fire or acid')],'shadowdark,core'),

  m('Troll Frost',7,13,34,'near','chaotic',3,2,3,-1,0,-1,
    [a(2,'claw','',5,'1d8','and'),a(1,'bite','',5,'1d12','')],
    [t('Impervious','immune cold/fire'),t('Regenerate','2d6/turn unless acid')],'shadowdark,core'),

  m('Unicorn',4,12,20,'double-near','lawful',3,2,2,1,1,3,
    [a(1,'hooves','',3,'1d6','')],
    [t('Healing Horn','touch 2d6 HP or end curse/disease')],'shadowdark,core'),

  m('Vampire',11,15,52,'near (climb)','chaotic',4,3,3,1,3,4,
    [a(3,'bite','',7,'1d8','or'),a(1,'charm','','','','')],
    [t('Supreme Undead','immune non-magical'),t('Blood Drain','2d8 healed; 1d4 CON loss'),t('Charm','DC15 CHA 1d4 days'),t('Shapechange','bat/wolf/humanoid'),t('Vampire','coffin/sunlight/stake weaknesses')],'shadowdark,core'),

  m('Vampire Spawn',5,13,25,'near (climb)','chaotic',3,2,3,-1,1,2,
    [a(2,'bite','',4,'1d8','')],
    [t('Greater Undead','immune non-magical'),t('Blood Drain','2d8 healed; 1d4 CON = spawn'),t('Vampire','coffin/sunlight/stake weaknesses')],'shadowdark,core'),

  m('Violet Fungus',2,7,9,'close','neutral',-3,-2,0,-4,-3,-4,
    [a(2,'tendril','near',0,'1d4','')],
    [],'shadowdark,core'),

  m('Viperian',3,13,13,'near','chaotic',1,1,0,0,0,0,
    [a(2,'scimitar','',2,'1d6','or'),a(1,'javelin','close/far',2,'1d4','')],
    [],'shadowdark,core'),

  m('Viperian Ophid',6,14,28,'near (climb)','chaotic',4,2,1,1,1,1,
    [a(3,'falchion','',5,'1d10','or'),a(2,'longbow','far',3,'1d8','')],
    [t('Impervious','immune to non-magical weapons')],'shadowdark,core'),

  m('Viperian Wizard',8,13,37,'near','chaotic',0,1,0,3,1,1,
    [a(1,'dagger','close/near',2,'1d4','or'),a(2,'spell','',5,'','')],
    [t('Hiss','INT end spell far'),t('Summon Cobra','INT 1d4 cobras 1d4 rds'),t('Venom','INT 2d8 far'),t('Whispers','INT DC14 disadvantage spells near')],'shadowdark,core'),

  m('Wight',4,15,22,'near','chaotic',3,0,2,0,1,-1,
    [a(2,'longsword','',4,'1d8','or'),a(1,'longbow','far',2,'1d8','')],
    [t('Greater Undead','immune non-magical'),t('Life Drain','1d4 CON; 0 CON = wight spawn')],'shadowdark,core'),

  m('Will-o-Wisp',3,15,13,'near (fly)','chaotic',-4,4,0,2,0,-2,
    [a(2,'shock','',3,'1d6','')],
    [t('Incorporeal','magical only'),t('Vanish','invisible until it attacks')],'shadowdark,core'),

  m('Witch',6,12,28,'near','chaotic',-1,2,1,3,2,2,
    [a(1,'staff','',1,'1d4','or'),a(2,'spell','',5,'','')],
    [t('Curse','CHA DC13 disadvantage all checks'),t('Evil Eye','CHA DC12 disadvantage next roll'),t('Polymorph','CHA DC14 small animal 2d4 rds')],'shadowdark,core'),

  m('Worg',3,13,16,'double-near','chaotic',3,2,1,-1,1,-2,
    [a(2,'bite','',3,'1d8','')],
    [t('Keen Senses',"can't be surprised")],'shadowdark,core'),

  m('Wraith',6,13,27,'near (fly)','chaotic',-3,3,2,1,2,-1,
    [a(2,'touch','',4,'1d8','')],
    [t('Greater Undead','immune non-magical'),t('Incorporeal','magical only'),t('Life Drain','1d4 CON; 0 CON = death')],'shadowdark,core'),

  m('Wyvern',7,14,35,'double-near (fly)','chaotic',4,2,2,-2,1,-2,
    [a(2,'rend','',5,'1d10','or'),a(1,'sting','',5,'1d6','')],
    [t('Poison','DC15 CON 0 HP')],'shadowdark,core'),

  m('Yellow Mold',2,9,9,'none','neutral',-4,-4,2,-4,-3,-4,
    [a(1,'spore-cloud','near',0,'1d6','')],
    [t('Spores','DC12 CON 1d4 CON/rd for 1d4 rds; no healing; die at 0'),t('Impervious','immune fire only')],'shadowdark,core'),

  m('Zombie',1,9,11,'near','chaotic',2,-2,2,-4,-3,-4,
    [a(1,'slam','',1,'1d6','')],
    [t('Undead','immune sleep/charm/morale'),t('Undying','at 0 HP DC9 CON or die; success = 1 HP')],'shadowdark,core'),
]

// ─── CURSED SCROLLS 1 ────────────────────────────────────────────────────────
const CS1 = [
  m('Bittermold',1,12,5,'near','chaotic',0,1,1,0,0,-2,
    [a(1,'shortsword','',1,'1d6','or'),a(1,'sling','far',2,'1d4','')],
    [t('Rubbery','half stab dmg')],'shadowdark,cs1'),

  m('Bogthorn',2,13,11,'near (climb)','chaotic',1,2,1,0,0,-2,
    [a(1,'stab','',0,'1d4','or'),a(1,'thorn-hail','near',2,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 rds')],'shadowdark,cs1'),

  m('Dralech',6,13,29,'near','chaotic',3,2,2,0,1,-1,
    [a(3,'bone-axe','',5,'2d6','')],
    [t('Shatter','destroy gear instead of dealing dmg')],'shadowdark,cs1'),

  m('Gordock Breeg',4,15,19,'near','neutral',3,1,2,0,1,-1,
    [a(1,'bastard-sword','',3,'1d10','or'),a(1,'sling','far',2,'1d4','')],
    [t('Algae-Eater','lose 1d4 HP for advantage on next check/attack')],'shadowdark,cs1','striker'),

  m('Hexling',2,12,11,'near','chaotic',-1,2,1,0,0,-2,
    [a(1,'chill-touch','',2,'1d6','')],
    [t('Energy Drain','1d4 CON dmg; 0 CON = become hexling')],'shadowdark,cs1'),

  m('Howler',1,15,5,'near','neutral',2,1,1,-1,1,-2,
    [a(1,'club','',2,'1d4','or'),a(1,'sling','far',2,'1d4','')],
    [t('Mob','+1 dmg with ally adjacent in melee')],'shadowdark,cs1'),

  m('Ichor Ooze',3,12,15,'near (climb)','neutral',1,1,1,-4,-3,-4,
    [a(2,'tendril','',3,'1d6','')],
    [t('Rubbery','half stab dmg'),t('Corrosive','metal/wood destroyed on d6=1')],'shadowdark,cs1'),

  m('Marrow Fiend',8,15,39,'near (climb)','chaotic',4,3,3,0,2,-1,
    [a(2,'claw','',7,'1d10','and'),a(1,'sap-gout','near-line',5,'2d6','')],
    [t('Devour','regain 3d8 HP instead of attacking'),t('Sap','DC15 DEX or stuck')],'shadowdark,cs1'),

  m('Mugdulblub',12,16,58,'near (climb/swim)','chaotic',4,2,4,1,2,-2,
    [a(3,'tendril','near',8,'2d8','and'),a(1,'dissolve','','','','')],
    [t('Rubbery','half stab dmg'),t('Mutagenic','random mutation on contact'),t('Dissolve','1d4 CON; 0 CON = ichor ooze')],'shadowdark,cs1','legendary'),

  m('Mutant Catfish',2,11,11,'near (swim)','neutral',2,-1,2,-3,0,-3,
    [a(1,'claw','',2,'1d6','or'),a(1,'barb','near',2,'1d4','')],
    [t('Poison','DC12 CON paralyzed 1d4 rds')],'shadowdark,cs1'),

  m('Plogrina B.',5,14,25,'near','chaotic',2,3,2,1,1,-1,
    [a(2,'tendril','near',4,'1d6','')],
    [t('Rubbery','half stab dmg'),t('Slime Form','become puddle 1d4 rds; half dmg')],'shadowdark,cs1','legendary'),

  m('Skrell',1,13,5,'double-near','chaotic',1,2,1,-1,0,-2,
    [a(1,'claw','',2,'1d6','')],
    [t('Clever','advantage doing same action consecutively')],'shadowdark,cs1'),

  m('Tar Bat',1,13,4,'near (fly)','neutral',-2,2,0,-3,0,-3,
    [a(1,'bite','',3,'1d4','')],
    [t('Pyro','seeks flames; ignites on contact +1d4 dmg; immune fire')],'shadowdark,cs1'),

  m('The Willowman',13,17,61,'near (teleport)','chaotic',4,4,3,3,3,4,
    [a(3,'finger-needle','',9,'2d10','and'),a(1,'terrify','','','','')],
    [t('Fearless','immune morale'),t('Terrify','DC15 CHA paralyzed'),t('Waking Nightmare','all near DC15 CHA flee')],'shadowdark,cs1','legendary'),
]

// ─── CURSED SCROLLS 2 ────────────────────────────────────────────────────────
const CS2 = [
  m('Camel Silver',2,10,13,'double-near','neutral',3,0,3,-2,1,-3,
    [a(1,'hoof','',3,'1d6','or'),a(1,'spit','near',0,'1d4','')],
    [],'shadowdark,cs2'),

  m('Canyon Ape',6,13,29,'near (climb)','neutral',4,2,2,-2,1,-2,
    [a(3,'rend','',6,'2d6','')],
    [t('Ambush','surprise on 1-3'),t('Stalk','track by scent')],'shadowdark,cs2'),

  m('Donkey',1,10,6,'near','neutral',2,0,1,-3,1,-3,
    [a(1,'hoof','',3,'1d4','')],
    [],'shadowdark,cs2'),

  m('Dunefiend',4,14,20,'near','chaotic',2,2,1,-1,1,-2,
    [a(2,'tear','',4,'1d8','or'),a(1,'howl','','','','')],
    [t('Howl','sleeping creatures DC12 CHA or no rest benefit')],'shadowdark,cs2'),

  m('Dust Devil',8,16,36,'double-near','chaotic',2,4,2,-2,1,-2,
    [a(2,'lacerate','',5,'2d8','')],
    [t('Impervious','immune magical only'),t('Fling','close DC15 DEX flung 1d100ft')],'shadowdark,cs2'),

  m('Hero',5,16,25,'near','neutral',3,2,2,1,1,1,
    [a(1,'bastard-sword','',5,'1d8','or'),a(1,'spear','close/near',5,'1d6','')],
    [],'shadowdark,cs2'),

  m('Horse War',3,11,15,'double-near','neutral',3,1,2,-3,1,-2,
    [a(1,'hooves','',4,'1d6','')],
    [],'shadowdark,cs2'),

  m('Mirage',8,6,32,'near','chaotic',-2,2,0,3,2,4,
    [a(1,'leech','','','','')],
    [t('Delude','DC18 INT to see through'),t('Leech','DC18 CHA or 3d6 dmg')],'shadowdark,cs2'),

  m('Ras-Godai',3,13,13,'near (teleport)','chaotic',1,3,1,1,1,-1,
    [a(1,'razor-chain','near',4,'1d6','')],
    [t('Assassinate','double dmg vs unaware')],'shadowdark,cs2'),

  m('Rookie',1,14,5,'near','neutral',1,1,1,0,0,0,
    [a(1,'shortsword','',1,'1d6','or'),a(1,'javelin','close/far',1,'1d4','')],
    [],'shadowdark,cs2'),

  m('Scrag',2,12,11,'near (climb)','neutral',2,1,1,-2,1,-2,
    [a(1,'claw','',2,'1d6','')],
    [],'shadowdark,cs2'),

  m('Scrag War',3,12,15,'near (climb)','neutral',2,1,1,-2,1,-2,
    [a(1,'claw','',3,'1d6','')],
    [],'shadowdark,cs2'),

  m('Siruul',2,14,9,'double-near','neutral',2,2,1,0,1,1,
    [a(1,'scimitar','',3,'1d6','or'),a(1,'longbow','far',3,'1d8','')],
    [t('Desert Born','advantage desert navigation/survival'),t('Mount','loyal silver camel')],'shadowdark,cs2'),

  m('The Scourge',18,17,84,'double-near (fly)','chaotic',5,4,4,3,3,4,
    [a(3,'rend','',10,'2d10','or'),a(1,'lightning-breath','','','','')],
    [t('Stormblood','immune lightning'),t('Corruption','corrupt lands in radius'),t('Lightning Breath','line DC15 DEX 5d8'),t('Mirage','1/day 3 duplicates')],'shadowdark,cs2','legendary'),
]

// ─── CURSED SCROLLS 3 ────────────────────────────────────────────────────────
const CS3 = [
  m('Drake Greater',8,15,38,'double-near (fly)','neutral',4,2,2,-2,1,-2,
    [a(2,'claw','',7,'1d12','or'),a(1,'fire-gout','','','','')],
    [t('Fireblood','immune fire'),t('Fire Gout','near cube DC12 DEX 4d6')],'shadowdark,cs3'),

  m('Drake Lesser',6,13,28,'double-near (fly)','neutral',3,2,2,-2,1,-2,
    [a(2,'claw','',5,'1d10','or'),a(1,'fire-spit','','','','')],
    [t('Fireblood','immune fire'),t('Fire Spit','double-near DC12 DEX 3d6')],'shadowdark,cs3'),

  m('Draugr',5,16,25,'near','chaotic',3,1,3,-1,1,-1,
    [a(2,'bastard-sword','',4,'1d8','')],
    [t('Greater Undead','immune non-magical'),t('Death Chill','cold aura near 1d4/turn'),t('Stone Swim','move through stone at near speed')],'shadowdark,cs3'),

  m('Dverg',3,13,14,'near','lawful',3,0,2,1,1,0,
    [a(1,'greataxe','',2,'1d10','')],
    [t('Shapeshift','any small animal')],'shadowdark,cs3'),

  m('Nord',2,15,10,'near','neutral',3,0,2,0,1,1,
    [a(1,'greataxe','',2,'1d8','or'),a(1,'shield-wall','','','','')],
    [t('Shield Wall','AC becomes 20 for 1 round')],'shadowdark,cs3'),

  m('Oracle',4,10,19,'near','neutral',0,1,1,3,2,1,
    [a(1,'stave','',2,'1d4','or'),a(1,'spell','',3,'','')],
    [t('Berserk','CHA near frenzy'),t('Fate','WIS see next danger'),t('Mjolnir','INT lightning strike'),t('Strike Blind','WIS DC12 blind')],'shadowdark,cs3'),

  m('Orca',8,12,39,'double-near (swim)','neutral',4,2,3,-2,1,-2,
    [a(2,'bite','',5,'1d10','')],
    [t('Pod Hunter','+2 dmg with ally near')],'shadowdark,cs3'),

  m('Sea Nymph',3,13,13,'near (swim)','neutral',1,2,1,1,2,3,
    [a(1,'slash','',2,'1d6','or'),a(1,'sing','','','','')],
    [t('Sing','double-near DC12 CHA transfixed 1d4 rds')],'shadowdark,cs3'),

  m('Sea Serpent',12,14,58,'double-near (swim)','neutral',5,2,4,-2,1,-2,
    [a(3,'bite','',8,'2d12','')],
    [],'shadowdark,cs3'),

  m('Troll Deep',8,13,39,'near','chaotic',4,2,3,-1,1,-2,
    [a(2,'claw','',7,'1d10','')],
    [t('Regenerate','2d6/turn unless cold iron')],'shadowdark,cs3'),

  m('Valkyrie',14,17,66,'double-near (fly)','lawful',4,3,3,3,4,4,
    [a(3,'blessed-spear','near',9,'3d6','')],
    [t('Impervious','immune magical only'),t('Divine Courage','near allies immune morale/fear')],'shadowdark,cs3'),

  m('Werebear',7,11,34,'near','lawful',4,1,3,0,2,0,
    [a(2,'claw','',6,'1d8','')],
    [t('Impervious','immune silver/magical'),t('Crush','extra die if both claws hit'),t('Lycanthropy','natural 15+ dmg infects')],'shadowdark,cs3'),
]

// ─── CURSED SCROLLS 4 ────────────────────────────────────────────────────────
const CS4 = [
  m('Anaconda Giant',7,12,33,'near (climb/swim)','neutral',4,2,2,-2,1,-2,
    [a(2,'bite','',6,'1d10','')],
    [t('Swallow','DC12 STR or swallowed; total darkness; 1d8/rd; regurgitate 15+ inside')],'shadowdark,cs4'),

  m('Ant Giant',1,12,5,'near (climb)','neutral',3,1,1,-3,0,-3,
    [a(1,'bite','',3,'1d6','')],
    [t('Grab','DC12 STR or pinned; can carry grabbed'),t('Mighty','advantage STR move objects')],'shadowdark,cs4'),

  m('Stone Warrior',1,12,5,'near','chaotic',2,1,1,0,1,-1,
    [a(1,'obsidian-spear-thrower','far',2,'1d8','')],
    [t('Camouflage','surprise on 1-3'),t('Basilisk Hatchling','1-in-6 has loyal hatchling')],'shadowdark,cs4'),

  m('Stone Shaman',4,11,19,'near','chaotic',2,1,1,0,3,1,
    [a(1,'obsidian-dagger','near',2,'1d6','and'),a(1,'spell','',4,'','')],
    [t('Daze','WIS DC12 dazed 1 rd'),t('Death Touch','WIS DC13 2d8')],'shadowdark,cs4'),

  m('Basilisk Hatchling',1,13,6,'near','neutral',1,0,2,-3,1,-2,
    [a(1,'bite','',1,'1d4','')],
    [t('Petrify','DC9 CON one limb petrified 1 day')],'shadowdark,cs4'),

  m('Blue Dart Frog',0,12,1,'near (climb)','neutral',-3,2,0,-3,1,-3,
    [a(1,'touch','',2,'1','')],
    [t('Toxin','DC15 CON or 0 HP death-timer 1 no magic heal; survive = clear all diseases')],'shadowdark,cs4'),

  m('Cobra Statue',6,14,30,'near','chaotic',4,1,3,-3,0,-3,
    [a(1,'bite','',4,'1d8','or'),a(1,'hypnotize','','','','')],
    [t('Impervious','immune magical only'),t('Hypnotize','DC12 CHA near stupefied 1 rd'),t('Poison','DC18 CON 0 HP')],'shadowdark,cs4'),

  m('Catfish Giant',12,13,56,'double-near (swim)','neutral',4,0,2,-3,1,-3,
    [a(2,'bite','',9,'2d10','')],
    [t('Swallow','natural 18-20; total darkness; 2d8/rd; regurgitate 15+ inside')],'shadowdark,cs4'),

  m('Condor Dire',3,11,16,'double-near (fly)','neutral',2,1,3,-2,1,-3,
    [a(2,'beak','',3,'1d8','')],
    [t('Grab','steal 1 random gear piece')],'shadowdark,cs4'),

  m('Death Slug',0,12,1,'close (climb)','neutral',-3,2,0,-3,-2,-3,
    [a(1,'bite','',0,'1','')],
    [t('Burrow','plunges under skin; AC→18; tunnels to heart; die in 1d4 rds unless slug killed')],'shadowdark,cs4'),

  m('Jaguar King',12,16,56,'near (climb)','neutral',3,4,2,0,3,3,
    [a(2,'obsidian-spear','close/near',7,'1d8','and'),a(1,'pounce','','','','')],
    [t('Pounce','jump near; land close; next melee with advantage')],'shadowdark,cs4','legendary'),

  m('Javelina',1,10,5,'near','chaotic',0,0,1,-3,-2,-2,
    [a(1,'tusk','',1,'1d6','')],
    [t('Rage','when injured d8 instead of d6')],'shadowdark,cs4'),

  m('Javelina Diseased',2,10,10,'near','chaotic',1,0,1,-3,0,-3,
    [a(1,'tusk','',2,'1d6','')],
    [t('Undead','immune morale'),t('Rage','when injured extra dmg die')],'shadowdark,cs4'),

  m('Kawitzek',9,13,44,'double-near','neutral',5,1,4,-3,3,-3,
    [a(3,'bite','',8,'2d12','or'),a(1,'spell','','','','')],
    [t('Whirlpool','WIS DC12 control water; immobilize')],'shadowdark,cs4'),

  m('Skandrill',3,13,14,'double-near','neutral',2,1,1,-3,1,-3,
    [a(2,'bite','',3,'1d8','')],
    [t('Fireblood','immune fire'),t('Greedy','steal metallic object instead of dealing dmg')],'shadowdark,cs4'),

  m('Skandrill Rex',4,13,19,'double-near','neutral',3,1,1,-3,1,-3,
    [a(2,'bite','',4,'1d8','or'),a(1,'scream','','','','')],
    [t('Fireblood','immune fire'),t('Greedy','steal metallic object'),t('Scream','1/day summon 1d4 skandrill in 2 rds')],'shadowdark,cs4'),

  m('Void Bat',4,13,19,'double-near (fly)','neutral',-1,3,1,-3,1,-3,
    [a(2,'scream','',4,'1d10','')],
    [t('Impervious','immune cold'),t('Absorb Ambient Light','dim torches to close range; regain 1d4 HP/turn'),t('Sunlight Sensitivity','disadvantage + 1d4/rd in sunlight')],'shadowdark,cs4'),

  m('Void Being',9,11,41,'near (climb)','chaotic',1,1,1,4,2,4,
    [a(3,'arm-stab','',8,'2d8','or'),a(1,'brain-meld','','','','')],
    [t('Greater Undead','immune non-magical'),t('Brain Meld','DC15 CHA near undead control 1d4 days'),t('Sunlight Sensitivity','disadvantage + 1d4/rd in sunlight')],'shadowdark,cs4'),
]

// ─── CURSED SCROLLS 5 ────────────────────────────────────────────────────────
const CS5 = [
  m('Bezelak',16,15,75,'double-near (climb)','chaotic',5,2,3,-2,3,-3,
    [a(3,'rend','',9,'2d10','and'),a(1,'fire-belch','','','','')],
    [t('Fire Belch','near cube DC15 DEX 4d10'),t('Bezoar','stomach contains 1d4 gems worth 500gp each + random Utility magic items')],'shadowdark,cs5','legendary'),

  m('Librarian of Leng',6,14,28,'near','chaotic',1,2,1,4,3,2,
    [a(1,'bite','',3,'1d6','or'),a(2,'spell','',6,'','')],
    [t('Impervious','immune silver/magical'),t('Overwhelm','disadvantage if eyes/ears uncovered'),t('Absorb','INT DC13 steal spell'),t('Eye of the Master','INT DC15 confuse/disintegrate/telekinesis'),t('Invoke Fear','INT DC12 cannot approach 1d4 rds'),t('Mind Pierce','INT DC13 2d6+blinded')],'shadowdark,cs5'),

  m('Dremir',3,11,14,'near','chaotic',0,2,1,2,1,1,
    [a(1,'rend','',3,'1d6','or'),a(1,'spell','',3,'','')],
    [t('Impale','INT DC12 1d6 far'),t('Slow','INT DC12 half speed 1d4 rds')],'shadowdark,cs5'),

  m('Nuln',3,12,13,'near','chaotic',1,1,0,0,0,-4,
    [a(2,'spear','close/near',3,'1d6','')],
    [t('Rage','1/day immune morale +1d4 dmg 3 rds'),t('Contagious Madness','DC12 CHA speaking = 1 CHA dmg')],'shadowdark,cs5'),

  m('Morzo Moth',8,16,37,'double-near (fly)','neutral',4,3,1,-3,-3,-3,
    [a(2,'bite','',6,'2d6','and'),a(1,'wing-dust','','','','')],
    [t('Grab','DC15 STR; auto-hit grabbed'),t('Wing Dust','near DC12 CON or lose half current HP; min 1')],'shadowdark,cs5'),

  m('Wendel',2,9,11,'near (climb)','neutral',2,-1,2,-3,0,-3,
    [a(1,'slam','',2,'1d6','')],
    [t('Sticky','climb sheer surfaces'),t('Type','d8 variety: 1=Pearly docile/2=Ocher toxic/3=Silky AC12/4=Puce acid spit/5=Red aggressive/6=Woolly cold immune/7=Sea swim breathe water/8=Spiny 1d10 slam')],'shadowdark,cs5'),
]

const ALL = [...CORE, ...CS1, ...CS2, ...CS3, ...CS4, ...CS5]

async function seed() {
  console.log('Deleting existing Shadowdark monsters for user...')
  await db.query('DELETE FROM monsters WHERE user_id=$1 AND game_system=$2', [USER_ID, GAME_SYSTEM])
  console.log('Inserting monsters...')
  for (const mon of ALL) {
    await db.query(
      `INSERT INTO monsters (user_id,game_system,name,challenge,tags,stat_data) VALUES ($1,$2,$3,$4,$5,$6)`,
      [USER_ID, GAME_SYSTEM, mon.name, mon.challenge, mon.tags, JSON.stringify(mon.stat_data)]
    )
  }
  console.log(`Done. Seeded ${ALL.length} Shadowdark monsters.`)
  console.log(`  Core: ${CORE.length} | CS1: ${CS1.length} | CS2: ${CS2.length} | CS3: ${CS3.length} | CS4: ${CS4.length} | CS5: ${CS5.length}`)
  process.exit(0)
}
seed().catch(err => { console.error(err.message); process.exit(1) })
