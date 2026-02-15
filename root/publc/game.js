const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

const socket = new WebSocket("wss://your-render-service.onrender.com");

let myId=null;
let players={};
let poisonClouds=[];

socket.onmessage=msg=>{
  const data=JSON.parse(msg.data);
  if(data.type==="init") myId=data.id;
  if(data.type==="state"){
    players=data.players;
    poisonClouds=data.poisonClouds;
  }
  if(data.type==="chat") addChatMessage(data.name+": "+data.message);
};

let keys={};
window.addEventListener("keydown",e=>{
  keys[e.key]=true;

  if(e.key==="Shift") trigger("dash");
  if(e.key==="q") trigger("poison");
  if(e.key==="e") trigger("shield");
});
window.addEventListener("keyup",e=>keys[e.key]=false);

function trigger(name){
  socket.send(JSON.stringify({type:"ability",ability:name}));
}

function update(){
  if(!players[myId]||!players[myId].alive) return;
  const me=players[myId];

  if(keys["ArrowUp"]) me.y-=me.speed;
  if(keys["ArrowDown"]) me.y+=me.speed;
  if(keys["ArrowLeft"]) me.x-=me.speed;
  if(keys["ArrowRight"]) me.x+=me.speed;

  socket.send(JSON.stringify({type:"move",x:me.x,y:me.y}));
}

function drawFish(p,color){
  if(!p.alive) return;

  ctx.save();
  ctx.translate(p.x,p.y);

  ctx.fillStyle=p.shield?"#00ffff":color;

  ctx.beginPath();
  ctx.ellipse(0,0,p.size*1.5,p.size,0,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-p.size*1.5,0);
  ctx.lineTo(-p.size*2,p.size);
  ctx.lineTo(-p.size*2,-p.size);
  ctx.fill();

  ctx.restore();
}

function drawPoison(){
  poisonClouds.forEach(c=>{
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.radius,0,Math.PI*2);
    ctx.fillStyle="rgba(0,255,0,0.2)";
    ctx.fill();
  });
}

function loop(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  update();

  for(let id in players){
    drawFish(players[id],id===myId?"yellow":"cyan");
  }

  drawPoison();

  requestAnimationFrame(loop);
}

loop();

/* Chat */
const chatBox=document.createElement("div");
chatBox.style.position="absolute";
chatBox.style.bottom="10px";
chatBox.style.left="10px";
chatBox.style.width="300px";
chatBox.style.height="150px";
chatBox.style.background="rgba(0,0,0,0.5)";
chatBox.style.overflowY="auto";
chatBox.style.color="white";
document.body.appendChild(chatBox);

const chatInput=document.createElement("input");
chatInput.style.position="absolute";
chatInput.style.bottom="10px";
chatInput.style.left="320px";
chatInput.placeholder="Type message...";
document.body.appendChild(chatInput);

chatInput.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&chatInput.value.trim()!==""){
    socket.send(JSON.stringify({type:"chat",message:chatInput.value}));
    chatInput.value="";
  }
});

function addChatMessage(msg){
  const div=document.createElement("div");
  div.innerText=msg;
  chatBox.appendChild(div);
  chatBox.scrollTop=chatBox.scrollHeight;
}
