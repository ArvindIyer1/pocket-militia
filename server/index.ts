import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WORLD, PLATFORMS, type Player, type Pickup, type Bullet, type Snapshot, type WeaponId } from '../shared/game';
const PORT=Number(process.env.PORT||8080);
const httpServer=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'content-type':'text/plain'});res.end('ok');return;}res.writeHead(200,{'content-type':'text/plain'});res.end('Pocket Militia WebSocket server');});
const server=new WebSocketServer({noServer:true});
httpServer.on('upgrade',(request,socket,head)=>{if(request.url!=='/ws'){socket.destroy();return;}server.handleUpgrade(request,socket,head,ws=>server.emit('connection',ws,request));});
type Client={ws:WebSocket;player:Player}; type Room={code:string;clients:Map<string,Client>;bullets:Bullet[];pickups:Pickup[];phase:'waiting'|'playing'|'ended';ends:number;feed:{text:string;at:number}[];lastState:number};
const rooms=new Map<string,Room>(); const colors=['#ff6b5e','#45d5b0','#f2c14e','#9b8cff','#55b7ff','#ff79bd','#b5de63','#ff9f43'];
const code=()=>Math.random().toString(36).slice(2,6).toUpperCase();
function makeRoom():Room {let c=code();while(rooms.has(c))c=code();const r:Room={code:c,clients:new Map(),bullets:[],pickups:[],phase:'waiting',ends:0,feed:[],lastState:0}; rooms.set(c,r); return r;}
function send(ws:WebSocket,obj:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(r:Room,obj:unknown){for(const c of r.clients.values())send(c.ws,obj);}
function addFeed(r:Room,text:string){r.feed.unshift({text,at:Date.now()});r.feed=r.feed.slice(0,5);}
function spawn(r:Room,p:Player){const floor=780;p.x=200+Math.random()*1400;p.y=floor-60;p.vx=0;p.vy=0;p.hp=100;p.ammo=p.ammoByWeapon[p.weapon];p.alive=true;p.grounded=true;}
function drop(r:Room,p:Player){p.alive=false;p.hp=0;p.deaths++;addFeed(r,`${p.name} was eliminated`);setTimeout(()=>{if(r.clients.has(p.id)&&r.phase==='playing')spawn(r,p)},2100);}
function state(r:Room):Snapshot{return {type:'state',players:[...r.clients.values()].map(c=>({...c.player})),bullets:r.bullets.map(b=>({...b})),pickups:r.pickups.map(p=>({...p})),timeLeft:r.phase==='playing'?Math.max(0,Math.ceil((r.ends-Date.now())/1000)):WORLD.roundSeconds,phase:r.phase,feed:r.feed,host:r.clients.keys().next().value||''};}
function start(r:Room){if(r.clients.size<2){broadcast(r,{type:'error',message:'A match needs at least 2 players. Share the room code to invite someone.'});return;}r.phase='playing';r.ends=Date.now()+WORLD.roundSeconds*1000;r.bullets=[];r.pickups=[{id:randomUUID(),x:470,y:730,kind:'rifle'},{id:randomUUID(),x:1200,y:730,kind:'health'},{id:randomUUID(),x:900,y:500,kind:'scatter'},{id:randomUUID(),x:1450,y:730,kind:'ammo'}]; for(const c of r.clients.values())spawn(r,c.player);addFeed(r,'Match started — 3:00 on the clock');broadcast(r,{type:'started'});}
server.on('connection',ws=>{let room:Room|undefined;let player:Player|undefined;ws.on('message',raw=>{try{const m=JSON.parse(raw.toString()); if(m.type==='join'){
 const name=String(m.name||'Rookie').replace(/[^\w -]/g,'').trim().slice(0,14)||'Rookie'; room=m.code?rooms.get(String(m.code).toUpperCase()):undefined;
 if(m.code&&!room){send(ws,{type:'error',message:'Room code not found. Check it and try again.'});return;}if(!room)room=makeRoom();if(room.clients.size>=8){send(ws,{type:'error',message:'That room is full (8 players).'});return;}
 const normalized=name.toLowerCase();if([...room.clients.values()].some(c=>c.player.name.toLowerCase()===normalized)){send(ws,{type:'error',message:'That name is already in use. Choose another.'});return;}
 const id=randomUUID(); player={id,name,x:180,y:720,vx:0,vy:0,aim:0,hp:100,ammo:12,weapon:'sidearm',inventory:['sidearm'],ammoByWeapon:{sidearm:12,rifle:0,scatter:0},kills:0,deaths:0,color:colors[room.clients.size%colors.length],grounded:true,alive:true,lastShot:0,lastSeen:Date.now()};room.clients.set(id,{ws,player});send(ws,{type:'joined',id,code:room.code});addFeed(room,`${name} dropped in`);return;}
 if(!room||!player)return;
 if(m.type==='start'){if(room.clients.keys().next().value===player.id)start(room);return;}
 if(m.type==='input'&&room.phase==='playing'&&player.alive){player.lastSeen=Date.now();player.aim=Number.isFinite(m.aim)?m.aim:player.aim;const keys=m.keys||{};player.vx=(keys.left?-1:0)+(keys.right?1:0);player.vx*=WORLD.runSpeed;if(keys.jump&&player.grounded){player.vy=-WORLD.jump;player.grounded=false;}if(keys.jet)player.vy=Math.max(-6,player.vy-WORLD.jet);if(['sidearm','rifle','scatter'].includes(m.weapon)&&player.inventory.includes(m.weapon as WeaponId)){player.weapon=m.weapon as WeaponId;player.ammo=player.ammoByWeapon[player.weapon];}
 if(keys.shoot&&Date.now()-player.lastShot>(player.weapon==='rifle'?115:player.weapon==='scatter'?500:300)&&player.ammo>0){player.lastShot=Date.now();player.ammo--;player.ammoByWeapon[player.weapon]=player.ammo;const specs={sidearm:{speed:13,damage:22,count:1},rifle:{speed:15,damage:13,count:1},scatter:{speed:11,damage:11,count:5}}[player.weapon];for(let i=0;i<specs.count;i++){const spread=(Math.random()-.5)*(player.weapon==='scatter'?.42:.035);const a=player.aim+spread;room.bullets.push({id:randomUUID(),x:player.x+Math.cos(a)*24,y:player.y-22+Math.sin(a)*24,vx:Math.cos(a)*specs.speed,vy:Math.sin(a)*specs.speed,owner:player.id,damage:specs.damage,life:90,color:player.weapon==='rifle'?'#5df5dc':player.weapon==='scatter'?'#ffac50':'#fff27c'});}}
 if(keys.reload&&player.ammo===0){player.ammo=player.weapon==='sidearm'?12:player.weapon==='rifle'?30:6;player.ammoByWeapon[player.weapon]=player.ammo;}
 }
 }catch{send(ws,{type:'error',message:'Could not read that game action.'});}});
 ws.on('close',()=>{if(room&&player){room.clients.delete(player.id);addFeed(room,`${player.name} left the room`);if(!room.clients.size)rooms.delete(room.code);else broadcast(room,{type:'notice',message:`${player.name} disconnected`});}});
});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){if(r.phase==='playing'){
 for(const c of r.clients.values()){const p=c.player;if(!p.alive)continue;p.x=Math.max(35,Math.min(WORLD.width-35,p.x+p.vx));const previousBottom=p.y+28;p.vy+=WORLD.gravity;p.y+=p.vy;p.grounded=false;if(p.vy>=0){for(const platform of PLATFORMS){const overlaps=p.x+11>platform.x&&p.x-11<platform.x+platform.w;if(overlaps&&previousBottom<=platform.y&&p.y+28>=platform.y){p.y=platform.y-28;p.vy=0;p.grounded=true;break;}}}if(p.y>=780-28){p.y=752;p.vy=0;p.grounded=true;}}
 for(const b of r.bullets){b.x+=b.vx;b.y+=b.vy;b.life--;const owner=r.clients.get(b.owner)?.player;for(const c of r.clients.values()){const p=c.player;if(!p.alive||p.id===b.owner)continue;if(Math.abs(b.x-p.x)<22&&b.y>p.y-54&&b.y<p.y+2){p.hp-=b.damage;b.life=0;if(p.hp<=0){drop(r,p);if(owner){owner.kills++;addFeed(r,`${owner.name} tagged ${p.name}`);}}break;}}}
 r.bullets=r.bullets.filter(b=>b.life>0&&b.x>0&&b.x<WORLD.width&&b.y>0&&b.y<WORLD.height);
 for(const item of r.pickups){for(const c of r.clients.values()){const p=c.player;if(p.alive&&Math.abs(item.x-p.x)<32&&Math.abs(item.y-p.y)<45){if(item.kind==='health')p.hp=Math.min(100,p.hp+45);else if(item.kind==='ammo'){p.ammo+=12;p.ammoByWeapon[p.weapon]=p.ammo;}else {const weapon=item.kind as WeaponId;if(!p.inventory.includes(weapon)){p.inventory.push(weapon);p.ammoByWeapon[weapon]+=weapon==='rifle'?30:6;}p.weapon=weapon;p.ammo=p.ammoByWeapon[weapon];}item.x=-1000;addFeed(r,`${p.name} grabbed ${item.kind}`);}}}r.pickups=r.pickups.filter(p=>p.x>=0);
 if(now>=r.ends){r.phase='ended';const winner=[...r.clients.values()].map(c=>c.player).sort((a,b)=>b.kills-a.kills)[0];addFeed(r,winner?`${winner.name} wins the round!`:'Round over');broadcast(r,{type:'ended',winner:winner?.name||'No winner'});}
 }
 if(now-r.lastState>50){broadcast(r,state(r));r.lastState=now;}}
},1000/60);
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`Pocket Militia WebSocket server listening on ${PORT}`));
