import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../front/package.json',import.meta.url)),dir=new URL('../front/public/shire/icons/',import.meta.url);fs.mkdirSync(dir,{recursive:true})
const shapes={
 wood:'<path fill="#b18a52" d="M8 22 36 9q9-2 12 7L20 38Z"/><ellipse cx="14" cy="30" rx="8" ry="9" fill="#dfbc77"/><ellipse cx="14" cy="30" rx="4" ry="5" fill="none"/>',
 stone:'<path fill="#96a18a" d="m7 34 5-18 19-7 13 13-5 17-20 6Z"/><path fill="none" d="m12 16 13 15 19-9M25 31l-6 14"/>',
 clay:'<path fill="#c29470" d="M12 40q-7-11 4-18l5-10 14 4 9 18-5 8Z"/><path fill="none" d="m16 25 16 5 7-6"/>',
 iron:'<path fill="#768980" d="m7 32 8-16 24-2 10 16-9 10-25 2Z"/><path fill="#b9c6ad" d="m15 16 9 15 25-1-10-16Z"/><path fill="none" d="m24 31-9 11"/>',
 herb:'<path fill="none" d="M26 44V10"/><path fill="#87a356" d="M25 28Q4 25 9 11q17 1 16 17Zm2-5q0-16 16-15 5 12-16 15Zm-1 17Q8 41 10 27q13-3 16 13Z"/>',
 apple:'<path fill="#b76242" d="M26 16C8 5 0 29 15 42q8 7 13 0 8 7 16-4 12-23-7-25Z"/><path fill="none" d="M27 17q-1-8 4-12"/><path fill="#789449" d="M29 12q12-12 17-1-9 6-17 1Z"/>',
 berry:'<path fill="#748a4b" d="m18 19 7-11 4 9 10-7-1 14Z"/><g fill="#785171"><circle cx="18" cy="28" r="9"/><circle cx="34" cy="28" r="9"/><circle cx="26" cy="39" r="9"/></g>',
 mushroom:'<path fill="#e1c794" d="m23 23-3 20q7 6 14 0l-3-20Z"/><path fill="#b68756" d="M5 27Q7 6 26 5q21 1 23 22-21 9-44 0Z"/><g fill="#f1dfb6"><circle cx="16" cy="20" r="3"/><circle cx="28" cy="13" r="3"/><circle cx="39" cy="22" r="3"/></g>',
 honey:'<path fill="#d7a744" d="m16 17-5 26q17 9 31 0l-5-26Z"/><path fill="#b1874a" d="M16 9h22v9H16Z"/><path fill="#eee0ae" d="M15 25h24v11H15Z"/>',
 flax:'<path fill="none" d="M24 46V17m0 13L11 19m13 8 13-13"/><g fill="#7b91ae"><circle cx="24" cy="11" r="7"/><circle cx="9" cy="17" r="5"/><circle cx="39" cy="12" r="5"/></g>',
 fish:'<path fill="#799a9b" d="M39 27Q24 3 6 25q13 26 33 3l10 13V13Z"/><circle cx="15" cy="24" r="2" fill="#243d34"/><path fill="none" d="M22 17q7 10 0 19"/>',
 egg:'<path fill="#e7d4ad" d="M26 5C11 8 4 29 12 41q13 14 27 0C47 29 40 8 26 5Z"/>',
 milk:'<path fill="#d3dfd0" d="M19 7h15v11l7 11v17H12V29l7-11Z"/><path fill="#f1ebcf" d="M14 30h25v14H14Z"/><path fill="#75938a" d="M18 4h17v7H18Z"/>',
 wool:'<g fill="#e4d9bb"><circle cx="26" cy="27" r="18"/><circle cx="13" cy="19" r="9"/><circle cx="36" cy="16" r="10"/><circle cx="40" cy="31" r="9"/><circle cx="17" cy="39" r="10"/></g><path fill="none" d="M17 29q-2-15 11-16m-6 27q-3-15 13-21"/>',
 flour:'<path fill="#d7c798" d="m15 13 5 7-9 24q17 8 31 0l-9-24 5-7Z"/><path fill="none" d="M18 21h17M26 38V27m0 6-5-3m5 0 5-3"/>',
 bread:'<path fill="#c79655" d="M5 29q3-22 23-21 22 2 20 26-23 17-41 6Z"/><path fill="none" d="m16 16 4 10m7-14 4 10m7-4 2 10"/>',
 stew:'<path fill="#916641" d="M5 23h44Q44 44 27 45 9 43 5 23Z"/><ellipse fill="#be9960" cx="27" cy="23" rx="22" ry="6"/><path fill="none" d="M17 15q-6-5 0-10m11 9q-6-4 0-10m11 11q-6-5 0-10"/>',
 pie:'<path fill="#b58a50" d="M8 27h40l-5 16q-18 8-31 0Z"/><ellipse fill="#daba79" cx="28" cy="25" rx="21" ry="12"/><path fill="none" d="m15 18 24 15m-15-20 22 14M13 30l24-13M25 36l20-14"/>',
 tea:'<path fill="#76968a" d="M8 19h29v18q-13 14-29 0Z"/><path fill="none" d="M37 22q21-2 4 15h-4M14 12q-5-5 1-9m10 10q-5-6 1-10"/><path fill="#d7c396" d="M5 43h37l-6 5H11Z"/>',
 cheese:'<path fill="#dbc071" d="m7 25 28-16 13 15-2 22H7Z"/><path fill="#edd799" d="m7 25 28-16 13 15Z"/><g fill="#c39b47"><circle cx="16" cy="36" r="3"/><circle cx="36" cy="32" r="3"/><circle cx="29" cy="41" r="2"/></g>',
 plank:'<path fill="#bf975b" d="m6 16 39-6 3 12-39 6Zm2 17 39-6 2 12-39 6Z"/><path fill="none" d="m12 20 26-4M15 36l24-4"/>',
 cloth:'<path fill="#7b9990" d="m9 11 30-4 8 33-33 7Z"/><path fill="none" d="m14 17 23-3m-21 9 23-3m-21 9 23-3m-21 9 23-3"/>',
 rope:'<g fill="none" stroke="#ab854c" stroke-width="6"><ellipse cx="25" cy="27" rx="16" ry="12"/><ellipse cx="25" cy="21" rx="16" ry="12"/><path d="M41 25q8 24-9 22"/></g>',
 arrow:'<path fill="none" stroke-width="4" d="M12 42 41 11"/><path fill="#9fac9c" d="m33 12 13-8-7 17Z"/><path fill="#b28b53" d="m11 31-6 5 4 11 12-3 5-6-11 2Z"/>',
 sword:'<path fill="#b4c5bc" d="m24 32-6-6L42 4l6 1-1 7Z"/><path fill="none" stroke-width="6" d="m18 32-11 13"/><path fill="none" stroke="#b59851" stroke-width="5" d="m12 25 16 14"/>',
 bow:'<path fill="none" stroke="#a3814c" stroke-width="5" d="M13 5q44 22 0 44"/><path fill="none" d="M13 5v44"/><path fill="none" stroke-width="3" d="M8 27h35m-6-4 7 4-7 4"/>',
 shield:'<path fill="#758b55" d="M7 10q20-10 40 0v16Q46 43 27 50 7 44 7 26Z"/><path fill="none" stroke="#d1ba78" stroke-width="4" d="M27 7v37M11 23h32"/><circle fill="#c1a459" cx="27" cy="25" r="7"/>',
 axe:'<path fill="none" stroke="#a88551" stroke-width="6" d="m13 46 22-37"/><path fill="#9eafa7" d="m30 13 7-10q0 9 12 12l-8 15-16-7Z"/>',
 lantern:'<path fill="none" d="M18 12V9q8-12 17 0v3"/><path fill="#ccaa5c" d="M12 15h30l-4 29H16Z"/><path fill="#efcf7f" d="M18 21h18v18H18Z"/><path fill="none" stroke-width="3" d="M10 15h34M13 45h28M27 20v20"/>',
 saddle:'<path fill="#977046" d="M8 13q14 18 38 0v27q-16-10-37 0Z"/><path fill="#c5a16d" d="M8 10q3-5 8 0l4 14h-8Zm29 0q4-5 9 0l-1 14H35Z"/><path fill="none" d="M17 31v16h9V31"/>',
 barley:'<path fill="none" d="m14 47 20-39"/><g fill="#c1a65e"><ellipse cx="23" cy="34" rx="8" ry="4" transform="rotate(25 23 34)"/><ellipse cx="29" cy="25" rx="8" ry="4" transform="rotate(25 29 25)"/><ellipse cx="35" cy="15" rx="8" ry="4" transform="rotate(25 35 15)"/></g>',
 carrot:'<path fill="#be854a" d="M16 17q8-5 19 6L10 48Z"/><path fill="#81974e" d="m23 20-8-13 10 2 6 9 3-14 8 5-8 15Z"/><path fill="none" d="m17 29 7 3m-11 7 5 2"/>',
 seed:'<path fill="#ac8751" d="M28 6C7 17 5 42 20 47 41 45 45 15 28 6Z"/><path fill="none" d="M28 13Q14 29 22 42"/>',
 feed:'<path fill="#b19462" d="m13 10 6 12-7 23q15 8 30 0l-8-23 7-12Z"/><path fill="none" d="M18 22h18"/><path fill="#e7d4a5" d="m27 28 7 8-7 6-7-6Z"/>',
 shire:'<circle cx="27" cy="27" r="25" fill="#284935" stroke="#c3a968" stroke-width="3"/><path fill="#728b4c" d="M3 36Q26 5 51 36v6H3Z"/><circle cx="27" cy="30" r="15" fill="#d0b880"/><circle cx="27" cy="30" r="12" fill="#55754a"/><path fill="none" stroke="#284935" d="M22 20v20m7-21v23m6-20v16"/><circle cx="32" cy="31" r="2" fill="#e7cd84"/><path fill="#acb27a" d="M16 45h22l7 7H9Z"/>'}
for(const [name,shape]of Object.entries(shapes)){const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54"><g stroke="#45543a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>`;fs.writeFileSync(new URL(name+'.svg',dir),svg)}
let sharp;try{sharp=require('sharp')}catch{sharp=require(process.env.SHIRE_SHARP_PATH||'C:/Users/mjneu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')}
const source=fs.readFileSync(new URL('shire.svg',dir));for(const size of [16,32,48,64,128,180,192,256,512])await sharp(source).resize(size,size).png().toFile(new URL(`shire-${size}.png`,dir).pathname.replace(/^\/(\w:)/,'$1'))
const sizes=[16,32,48,64,128,256],pngs=sizes.map(n=>fs.readFileSync(new URL(`shire-${n}.png`,dir))),header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;pngs.forEach((p,i)=>{const at=6+i*16;header[at]=sizes[i]%256;header[at+1]=sizes[i]%256;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(p.length,at+8);header.writeUInt32LE(offset,at+12);offset+=p.length});fs.writeFileSync(new URL('shire.ico',dir),Buffer.concat([header,...pngs]))
fs.writeFileSync(new URL('../manifest.webmanifest',dir),JSON.stringify({name:'The Shire · A place to call home',short_name:'The Shire',start_url:'/play/shire',display:'standalone',background_color:'#243e2d',theme_color:'#36583f',icons:[192,512].map(n=>({src:`/shire/icons/shire-${n}.png`,sizes:`${n}x${n}`,type:'image/png',purpose:'any'}))},null,2))
console.log(`Created ${Object.keys(shapes).length} original item/identity vectors and Windows/browser icon sizes.`)
