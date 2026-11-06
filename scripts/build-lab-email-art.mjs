import fs from 'node:fs';
import {createCanvas} from '@napi-rs/canvas';
const palettes={brand:['#242424','#38322d','#9d5a28'],amber:['#fff1d6','#e5ce9d','#c69743'],mint:['#e9f5ec','#c6dfcc','#80ad91'],blue:['#eaf3f9','#c6dce8','#83aabd'],rose:['#fcebe7','#e9c9c2','#cc9389']};
for(const [name,[bg,line,dot]]of Object.entries(palettes)){
 const c=createCanvas(1280,500),x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,1280,500);x.lineWidth=2;
 for(const [cx,cy,r]of [[1160,60,170],[1160,60,235],[1160,60,300],[-50,470,150]]){x.strokeStyle=line;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.stroke();}
 x.fillStyle=line;for(let y=35;y<470;y+=38)for(let col=970;col<1250;col+=38){x.beginPath();x.arc(col,y,2,0,Math.PI*2);x.fill();}
 x.strokeStyle=dot;x.lineWidth=3;for(const [a,b]of [[1035,295],[1190,385]]){x.beginPath();x.moveTo(a-9,b);x.lineTo(a+9,b);x.moveTo(a,b-9);x.lineTo(a,b+9);x.stroke();}
 fs.writeFileSync('assets/nest-lab-email-'+name+'.png',c.toBuffer('image/png'));
}
const c=createCanvas(720,240),x=c.getContext('2d');x.translate(360,120);x.rotate(-.045);x.strokeStyle='#a9dcff';x.fillStyle='#a9dcff';x.lineWidth=8;x.beginPath();x.roundRect(-325,-86,650,172,13);x.stroke();x.lineWidth=2;x.beginPath();x.roundRect(-313,-74,626,148,8);x.stroke();x.textAlign='center';x.font='bold 74px Arial';x.fillText('CHECKED IN',0,5);x.font='bold 22px Arial';x.fillText('NEST™ LAB  ·  ARRIVAL CONFIRMED',0,48);
// A restrained ink texture keeps the stamp readable at small email sizes.
let seed=29;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);x.globalCompositeOperation='destination-out';for(let i=0;i<800;i++){x.beginPath();x.arc(rand()*650-325,rand()*172-86,rand()*1.6+.3,0,Math.PI*2);x.fill();}
fs.writeFileSync('assets/nest-lab-checked-in-stamp.png',c.toBuffer('image/png'));
console.log('Created four status textures and the transparent checked-in stamp.');
