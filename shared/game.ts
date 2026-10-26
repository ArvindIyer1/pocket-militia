export const PLATFORMS = [...[120,380,730,1050,1400,1640].flatMap(x=>[{x,y:670,w:180,h:16},{x:x+30,y:580,w:105,h:14}]),{x:560,y:510,w:170,h:15},{x:1180,y:500,w:145,h:15}];
export const WORLD = { width: 1800, height: 900, gravity: 0.52, runSpeed: 4.2, jump: 11.5, jet: 0.32, roundSeconds: 180 };
export type WeaponId = 'sidearm'|'rifle'|'scatter';
export type Player = {id:string; name:string; x:number;y:number;vx:number;vy:number; aim:number; hp:number; ammo:number; weapon:WeaponId; inventory:WeaponId[]; ammoByWeapon:Record<WeaponId,number>; kills:number; deaths:number; color:string; grounded:boolean; alive:boolean; lastShot:number; lastSeen:number};
export type Pickup = {id:string;x:number;y:number;kind:'health'|'ammo'|'rifle'|'scatter'};
export type Bullet = {id:string;x:number;y:number;vx:number;vy:number;owner:string;damage:number;life:number;color:string};
export type Snapshot = {type:'state'; players:Player[];bullets:Bullet[];pickups:Pickup[];timeLeft:number;phase:'waiting'|'playing'|'ended';feed:{text:string;at:number}[];host:string};
