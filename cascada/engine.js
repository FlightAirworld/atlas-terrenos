/* Cascada · motor de premios (sin dependencias, navegador y Node) */
const CascadaEngine = (() => {
  const NAMES = ['Gota', 'Ola', 'Pez', 'Concha', 'Estrella', 'Delfín', 'Perla', 'Cofre'];
  // [símbolo, cantidad consecutiva, premio base, peso sobre 100.000]
  const PAY = [
    [0,3,1,9420],[1,3,2,5000],[2,3,3,2420],[3,3,5,1760],[2,4,8,880],[4,3,10,440],
    [4,4,15,200],[3,4,20,120],[5,3,30,100],[2,5,50,50],[1,5,75,30],
    [5,5,100,100],[6,4,150,50],[7,4,250,26],[6,5,500,12],[7,5,1000,6]
  ];
  // 3 horizontales y 2 diagonales en zigzag. Se recorren en ambos sentidos.
  const LINES = [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]];
  // BONUS_W = 0: los tres cofres ya NO salen por sorteo en cada partida; el servidor los fuerza cada 30 o 50 partidas de cada jugador (bonus()).
  const BONUS_W=0,TOTAL=100000,FILL=[22,20,18,14,10,7,5,4],FILL_SUM=FILL.reduce((a,b)=>a+b,0);
  const draw=()=>{let r=Math.random()*TOTAL,a=0;for(const [sym,count,prize,w] of PAY){a+=w;if(r<a)return{sym,count,prize};}a+=BONUS_W;if(r<a)return{sym:7,count:3,prize:0,bonus:true};return{sym:-1,count:0,prize:0};};
  const fillSym=()=>{let r=Math.random()*FILL_SUM,a=0;for(let i=0;i<FILL.length;i++){a+=FILL[i];if(r<a)return i;}return 0;};
  const tier=p=>p>=1000?3:p>=250?2:p>=100?1:0;
  const payoutFor=(sym,count)=>{let best=0;for(const p of PAY)if(p[0]===sym&&p[1]<=count&&p[2]>best)best=p[2];return best;};
  const PATHS = LINES.map(rows => rows.map((row, col) => ({ row, col }))).concat(
    Array.from({ length: 5 }, (_, col) => [0,1,2].map(row => ({ row, col })))
  );
  const scanLine=(grid,cells,lineIndex)=>{
    const found=[];
    for(const dir of [1,-1]){
      const path=dir===1?cells:cells.slice().reverse();
      const {row,col}=path[0],sym=grid[row][col];
      let count=1;
      for(let k=1;k<path.length;k++){
        const p=path[k];
        if(grid[p.row][p.col]!==sym)break;
        count++;
      }
      const prize=count>=3?payoutFor(sym,count):0;
      if(prize)found.push({line:lineIndex+1,direction:cells[0].col===cells[cells.length-1].col?(dir===1?'arriba-abajo':'abajo-arriba'):(dir===1?'izquierda-derecha':'derecha-izquierda'),sym,count,prize,cells:path.slice(0,count)});
    }
    return found.sort((a,b)=>b.prize-a.prize)[0]||null;
  };
  const evaluate=grid=>PATHS.map((cells,i)=>scanLine(grid,cells,i)).filter(Boolean);
  const buildGrid=o=>{
    if(o.bonus){const g=Array.from({length:3},()=>Array.from({length:5},fillSym));for(let c=0;c<3;c++)g[1][c]=7;return g;}
    // La cuadrícula base no debe regalar premios aleatorios: los premios nacen del sorteo del servidor.
    let g,tries=0;do{g=Array.from({length:3},()=>Array.from({length:5},fillSym));tries++;}while(evaluate(g).length&&tries<500);
    if(o.prize>0){const li=Math.floor(Math.random()*LINES.length),dir=Math.random()<.5?1:-1,cols=dir===1?[0,1,2,3,4]:[4,3,2,1,0],rows=LINES[li];for(let k=0;k<o.count;k++){const c=cols[k];g[rows[c]][c]=o.sym;}}
    return g;
  };
  const play=()=>{const o=draw();if(o.bonus){const grid=buildGrid(o);return{sym:7,count:3,prize:0,tier:0,bonus:true,grid,lines:[]};}const grid=buildGrid(o),lines=evaluate(grid),prize=lines.reduce((s,l)=>s+l.prize,0),primary=lines.slice().sort((a,b)=>b.prize-a.prize)[0];return{sym:primary?primary.sym:o.sym,count:primary?primary.count:o.count,prize,tier:tier(primary?primary.prize:0),bonus:false,grid,lines};};
  // Partida con los tres cofres en la línea central (abre la partida especial del tesoro). La usa el servidor cada 30 o 50 partidas.
  const bonus=()=>({sym:7,count:3,prize:0,tier:0,bonus:true,grid:buildGrid({bonus:true}),lines:[]});
  return{NAMES,PAY,LINES,PATHS,TOTAL,BONUS_W,play,bonus,tier,evaluate};
})();
if(typeof module!=='undefined')module.exports=CascadaEngine;
