const express = require("express");
const WebSocket = require("ws");
const http = require("http");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_LEVEL = 11;

let players = {};
let poisonClouds = [];

function createPlayer(id) {
  return {
    id,
    x: Math.random()*1200,
    y: Math.random()*800,
    size: 20,
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    name: "Player" + id.slice(-3),

    speed: 4,
    shield: false,
    dashCooldown: 0,
    poisonCooldown: 0,
    shieldCooldown: 0
  };
}

function levelUp(p){
  if(p.level<MAX_LEVEL && p.xp>=p.level*50){
    p.level++;
    p.size+=3;
    p.maxHp+=20;
    p.hp=p.maxHp;
  }
}

function damage(attacker, defender, amount){
  if(defender.shield) amount*=0.4;
  defender.hp-=amount;

  if(defender.hp<=0){
    defender.alive=false;
    attacker.xp+=40;
    attacker.size+=2;
    levelUp(attacker);

    setTimeout(()=>{
      players[defender.id]=createPlayer(defender.id);
    },3000);
  }
}

function checkPvP(){
  const ids=Object.keys(players);
  for(let i=0;i<ids.length;i++){
    for(let j=i+1;j<ids.length;j++){
      const a=players[ids[i]];
      const b=players[ids[j]];
      if(!a||!b||!a.alive||!b.alive) continue;

      const dist=Math.hypot(a.x-b.x,a.y-b.y);
      if(dist<a.size+b.size){
        if(a.size>b.size) damage(a,b,10+a.level*2);
        else damage(b,a,10+b.level*2);
      }
    }
  }
}

function updatePoison(){
  poisonClouds.forEach((cloud,index)=>{
    cloud.duration-=50;

    Object.values(players).forEach(p=>{
      if(!p.alive) return;
      const dist=Math.hypot(p.x-cloud.x,p.y-cloud.y);
      if(dist<cloud.radius){
        damage(cloud.owner,p,5);
      }
    });

    if(cloud.duration<=0) poisonClouds.splice(index,1);
  });
}

wss.on("connection", ws=>{
  const id=Date.now().toString();
  players[id]=createPlayer(id);

  ws.send(JSON.stringify({type:"init",id}));

  ws.on("message",msg=>{
    const data=JSON.parse(msg);
    const p=players[id];
    if(!p) return;

    if(data.type==="move" && p.alive){
      p.x=data.x;
      p.y=data.y;
    }

    if(data.type==="ability"){
      if(data.ability==="dash" && p.dashCooldown<=0){
        p.speed=10;
        p.dashCooldown=3000;
        setTimeout(()=>p.speed=4,300);
      }

      if(data.ability==="poison" && p.poisonCooldown<=0){
        poisonClouds.push({
          x:p.x,
          y:p.y,
          radius:80,
          duration:3000,
          owner:p
        });
        p.poisonCooldown=5000;
      }

      if(data.ability==="shield" && p.shieldCooldown<=0){
        p.shield=true;
        p.shieldCooldown=7000;
        setTimeout(()=>p.shield=false,2000);
      }
    }

    if(data.type==="chat"){
      const payload=JSON.stringify({
        type:"chat",
        name:p.name,
        message:data.message
      });
      wss.clients.forEach(c=>{
        if(c.readyState===WebSocket.OPEN) c.send(payload);
      });
    }
  });

  ws.on("close",()=>delete players[id]);
});

setInterval(()=>{
  Object.values(players).forEach(p=>{
    p.dashCooldown=Math.max(0,p.dashCooldown-50);
    p.poisonCooldown=Math.max(0,p.poisonCooldown-50);
    p.shieldCooldown=Math.max(0,p.shieldCooldown-50);
  });

  checkPvP();
  updatePoison();

  const payload=JSON.stringify({
    type:"state",
    players,
    poisonClouds
  });

  wss.clients.forEach(c=>{
    if(c.readyState===WebSocket.OPEN) c.send(payload);
  });

},50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
