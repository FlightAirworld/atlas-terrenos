'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine');
const grid=()=>[[0,1,2,3,4],[1,2,3,4,5],[2,3,4,5,6]];
test('hay cinco líneas horizontales/diagonales y cinco verticales',()=>{
  assert.equal(E.LINES.length,5);
  assert.equal(E.PATHS.length,10);
  assert.deepEqual(E.LINES[3],[0,1,2,1,0]);
  assert.deepEqual(E.LINES[4],[2,1,0,1,2]);
});
test('detecta premios horizontales de izquierda a derecha y derecha a izquierda',()=>{
  const g=grid(); g[0]=[2,2,2,4,1]; g[2]=[0,3,4,1,1];
  const wins=E.evaluate(g);
  assert.ok(wins.some(x=>x.line===1&&x.direction==='izquierda-derecha'&&x.prize===3));
  const h=grid(); h[1]=[0,4,2,2,2];
  const rev=E.evaluate(h);
  assert.ok(rev.some(x=>x.line===2&&x.direction==='derecha-izquierda'));
});
test('detecta las dos diagonales en ambos sentidos',()=>{
  const g=grid();
  for(let c=2;c<5;c++)g[[0,1,2,1,0][c]][c]=5;
  const wins=E.evaluate(g);
  assert.ok(wins.some(x=>x.line===4&&x.direction==='derecha-izquierda'));
  const h=grid();
  for(let c=0;c<3;c++)h[[2,1,0,1,2][c]][c]=4;
  const w=E.evaluate(h);
  assert.ok(w.some(x=>x.line===5&&x.direction==='izquierda-derecha'));
});
test('detecta premios verticales de arriba abajo y de abajo arriba',()=>{
  const g=grid(); g[0][2]=4; g[1][2]=4; g[2][2]=4;
  const wins=E.evaluate(g);
  assert.ok(wins.some(x=>x.direction==='arriba-abajo'&&x.prize===10));
  const h=grid(); h[0][4]=2; h[1][4]=2; h[2][4]=2;
  const rev=E.evaluate(h);
  assert.ok(rev.some(x=>x.line===10&&x.prize===3));
});
test('cada línea paga una sola vez y el total suma todas las líneas',()=>{
  const g=grid(); g[0]=[2,2,2,1,4]; g[2]=[3,3,3,1,4];
  const wins=E.evaluate(g);
  assert.ok(wins.length>=2);
  assert.equal(wins.reduce((s,x)=>s+x.prize,0),8);
  assert.ok(wins.every(x=>x.cells.length===x.count));
});
test('las partidas generadas exponen líneas y premios coherentes',()=>{
  for(let i=0;i<3000;i++){
    const r=E.play();
    assert.equal(r.prize,r.lines.reduce((s,x)=>s+x.prize,0));
    assert.ok(r.lines.every(x=>x.line>=1&&x.line<=10));
    if(!r.bonus && r.sym===-1) assert.equal(r.lines.length,0);
    if(r.bonus){assert.equal(r.prize,0);assert.equal(r.grid[1].slice(0,3).filter(x=>x===7).length,3);}
  }
});
