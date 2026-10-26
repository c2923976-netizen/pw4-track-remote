'use strict';
const $=id=>document.getElementById(id);
const labels={w:'前进',s:'后退',a:'左转',d:'右转'};
const pointers=new Map(),keys=new Set();
let device=null,characteristic=null,ready=false,desired='x',pending=null,pump=null,blocked=false,epoch=0;
const encoder=new TextEncoder();
function paint(){ $('badge').textContent=ready?'已连接':'未连接';$('status').textContent=ready?(desired==='x'?'已连接 · 停车':'按住中 · '+labels[desired]):'未连接 · 停车';document.querySelectorAll('[data-key]').forEach(b=>{b.disabled=!ready;b.classList.toggle('active',ready&&desired===b.dataset.key);});$('stop').disabled=!ready;$('disconnect').disabled=!ready;$('connect').disabled=ready; }
function fail(message){epoch++;ready=false;desired='x';pending=null;pointers.clear();keys.clear();blocked=false;characteristic=null;try{device?.gatt.disconnect();}catch{}paint();$('error').textContent=message;}
function send(c){if(!ready||!characteristic)return Promise.resolve();pending=c;if(pump)return pump;const myEpoch=epoch;const channel=characteristic;
 pump=(async()=>{try{while(pending!==null&&ready&&myEpoch===epoch){const next=pending;pending=null;let timer;try{const write=channel.properties.write?channel.writeValueWithResponse(encoder.encode(next)):channel.writeValueWithoutResponse(encoder.encode(next));await Promise.race([write,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('蓝牙发送超时')),700);})]);}finally{clearTimeout(timer);}}}catch(e){if(myEpoch===epoch)fail(e.message+'；已停止继续发送，请重新连接。');}finally{pump=null;}})();return pump;}
function halt(){pointers.clear();keys.clear();blocked=false;desired='x';paint();return send('x');}
function update(){const count=pointers.size+keys.size;if(count>1)blocked=true;if(count===0)blocked=false;desired=!blocked&&count===1?(pointers.size?[...pointers.values()][0]:[...keys][0]):'x';paint();send(desired);}
$('connect').onclick=async()=>{halt();$('error').textContent='';if(!navigator.bluetooth){$('error').textContent='请在 iPhone 的 Bluefy 中打开此网页。普通 Safari 无法使用这里的蓝牙连接。';return;}$('connect').disabled=true;$('status').textContent='请选择 E104-BT08…';try{if(pump)await pump;device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'E104-BT08'}],optionalServices:[0xfff0]});device.addEventListener('gattserverdisconnected',()=>{if(ready)fail('蓝牙已断开，重新连接后才能操作。');});const server=await device.gatt.connect();const service=await server.getPrimaryService(0xfff0);characteristic=await service.getCharacteristic(0xfff2);if(!characteristic.properties.write&&!characteristic.properties.writeWithoutResponse)throw Error('FFF2 不支持写入');epoch++;ready=true;desired='x';paint();await send('x');$('connect').blur();}catch(e){fail(e.name==='NotFoundError'?'已取消选择。':e.message+'。请先断开 nRF Connect 中的连接。');}finally{$('connect').disabled=ready;}};
$('disconnect').onclick=async()=>{await halt();fail('已断开连接。');};$('stop').onclick=halt;
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('pointerdown',e=>{if(!ready)return;e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b.dataset.key);update();});b.addEventListener('pointerup',e=>{e.preventDefault();pointers.delete(e.pointerId);update();});for(const event of ['pointercancel','lostpointercapture'])b.addEventListener(event,e=>{if(pointers.has(e.pointerId))halt();});});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(e.ctrlKey||e.altKey||e.metaKey)return;if(k==='x'||e.code==='Space'){e.preventDefault();halt();return;}if(!ready||!(k in labels))return;e.preventDefault();if(!e.repeat){keys.add(k);update();}});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in labels){keys.delete(k);update();}});
window.addEventListener('blur',halt);window.addEventListener('pagehide',halt);document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});
setInterval(()=>{if(ready&&desired!=='x'){if(document.hidden){halt();return;}send(desired);}},150);
paint();
