import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Platform { x:number;y:number;w:number;h:number; }
interface Star { x:number;y:number;collected:boolean; }
interface Enemy { x:number;y:number;vx:number;w:number;h:number; }

@Component({
  selector: 'app-game-platformer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🤖 Platformer IA Hero</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cvs></canvas>
          <div class="gp-overlay" *ngIf="gameOver || !started">
            <div class="gp-overlay-icon">🤖</div>
            <div class="gp-overlay-title">{{gameOver ? 'Game Over' : 'Platformer Hero'}}</div>
            <div class="gp-overlay-score" *ngIf="gameOver">Score : {{score}}</div>
            <div class="gp-overlay-sub" *ngIf="!gameOver">Saute et collecte des étoiles !</div>
            <button class="gp-btn" (click)="startGame()">{{gameOver ? 'Rejouer' : 'Lancer'}}</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑</span> Saut (x2)</div>
            <div class="gp-ctrl-row"><span class="gp-key">Espace</span> Saut</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Mobile</div>
            <button class="jump-btn" (touchstart)="doJump()">⬆ Sauter</button>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">À propos</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Runner infini — évite les ennemis rouges, collecte les étoiles jaunes !</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a 0%,#0f172a 50%,#0a1628 100%);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .gp-back{color:#64748b;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);transition:all .2s}
    .gp-back:hover{color:#0d9488;border-color:#0d9488;background:rgba(13,148,136,.1)}
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .gp-canvas-wrap{position:relative;flex-shrink:0}
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3),0 0 120px rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.3)}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;gap:8px}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
    .gp-overlay-sub{font-size:14px;color:#64748b}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .gp-btn:hover{transform:translateY(-2px)}
    .jump-btn{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(13,148,136,.4);background:rgba(13,148,136,.15);color:#0d9488;font-size:14px;font-weight:700;cursor:pointer}
  `]
})
export class GamePlatformerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  score = 0; best = 0; gameOver = false; started = false;

  private W = 720; private H = 420;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;
  private player = { x:100, y:300, vx:0, vy:0, w:36, h:40, jumps:0, onGround:false };
  private platforms: Platform[] = [];
  private stars: Star[] = [];
  private enemies: Enemy[] = [];
  private scrollX = 0; private frameCount = 0;
  private keys: Record<string,boolean> = {};
  private jumpPressed = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const h = Math.min(window.innerHeight-80, 460);
    const w = Math.min(window.innerWidth-240, 780);
    this.W = w; this.H = h;
    const cv = this.cvsRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    cv.addEventListener('click', () => this.doJump());
    this.drawIdle();
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  startGame() {
    this.score=0; this.gameOver=false; this.started=true;
    this.best=parseInt(localStorage.getItem('platformer-best')||'0',10);
    this.player={x:100,y:this.H-100,vx:3,vy:0,w:36,h:40,jumps:0,onGround:false};
    this.scrollX=0; this.frameCount=0; this.platforms=[]; this.stars=[]; this.enemies=[];
    this.generateInitialWorld();
    cancelAnimationFrame(this.raf);
    this.raf=requestAnimationFrame(()=>this.loop());
    this.cdr.detectChanges();
  }

  doJump() {
    if (!this.started) { this.startGame(); return; }
    if (this.player.jumps < 2) { this.player.vy=-12; this.player.jumps++; this.player.onGround=false; }
  }

  private generateInitialWorld() {
    const H=this.H, W=this.W;
    this.platforms.push({x:0,y:H-40,w:W*3,h:40});
    let px=200;
    for(let i=0;i<12;i++){
      px+=180+Math.random()*120;
      const py=H-100-Math.random()*160, pw=80+Math.random()*60;
      this.platforms.push({x:px,y:py,w:pw,h:16});
      if(Math.random()>0.4) this.stars.push({x:px+pw/2,y:py-24,collected:false});
      if(Math.random()>0.6&&i>2) this.enemies.push({x:px+10,y:py-32,vx:1+Math.random(),w:28,h:28});
    }
  }

  private generateMore() {
    const lastP=this.platforms.reduce((max,p)=>p.x+p.w>max?p.x+p.w:max,0);
    if(lastP-this.scrollX<this.W*2){
      let px=lastP+160+Math.random()*100;
      const py=this.H-100-Math.random()*160, pw=80+Math.random()*60;
      this.platforms.push({x:px,y:py,w:pw,h:16});
      if(Math.random()>0.4) this.stars.push({x:px+pw/2,y:py-24,collected:false});
      if(Math.random()>0.5) this.enemies.push({x:px+10,y:py-32,vx:(1+Math.random())*(Math.random()>.5?1:-1),w:28,h:28});
    }
  }

  private loop() {
    if(this.gameOver)return;
    this.update(); this.drawScene();
    this.raf=requestAnimationFrame(()=>this.loop());
  }

  private update() {
    this.frameCount++; this.score=Math.floor(this.frameCount/6);
    const p=this.player;
    p.vy+=0.5; p.x+=p.vx; p.y+=p.vy;
    p.onGround=false;
    this.platforms.forEach(pl=>{
      if(p.x+p.w>pl.x&&p.x<pl.x+pl.w&&p.y+p.h>pl.y&&p.y+p.h<pl.y+pl.h+16&&p.vy>=0){p.y=pl.y-p.h;p.vy=0;p.onGround=true;p.jumps=0;}
    });
    const screenX=p.x-this.scrollX;
    if(screenX>this.W*0.5) this.scrollX=p.x-this.W*0.5;
    this.stars.forEach(s=>{if(!s.collected&&Math.abs(s.x-p.x)<p.w&&Math.abs(s.y-p.y)<p.h+20){s.collected=true;this.score+=10;}});
    this.enemies.forEach(e=>{
      e.x+=e.vx;
      const ep=this.platforms.find(pl=>e.x>pl.x&&e.x<pl.x+pl.w-e.w&&Math.abs(e.y-pl.y+e.h)<10);
      if(!ep||e.x<0)e.vx*=-1;
      if(Math.abs(e.x-p.x)<p.w&&Math.abs(e.y-p.y)<p.h)this.endGame();
    });
    if(p.y>this.H+50)this.endGame();
    this.platforms=this.platforms.filter(pl=>pl.x+pl.w>this.scrollX-200);
    this.stars=this.stars.filter(s=>s.x>this.scrollX-100);
    this.enemies=this.enemies.filter(e=>e.x>this.scrollX-100);
    this.generateMore();
  }

  private endGame() {
    this.gameOver=true;
    if(this.score>this.best){this.best=this.score;localStorage.setItem('platformer-best',String(this.best));}
    this.cdr.detectChanges();
  }

  private drawIdle() {
    if(!this.ctx)return;
    this.ctx.fillStyle='#0f172a';this.ctx.fillRect(0,0,this.W,this.H);
  }

  private drawScene() {
    const ctx=this.ctx, W=this.W, H=this.H;
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#050d1a');bg.addColorStop(1,'#0f172a');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.5)';
    for(let i=0;i<60;i++){ctx.fillRect(((i*179+3)%W),((i*97+11)%(H-60)),1,1);}
    ctx.save();ctx.translate(-this.scrollX,0);
    this.platforms.forEach(pl=>{
      ctx.fillStyle=pl.h===40?'#1e293b':'#1e40af';ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
      if(pl.h!==40){ctx.fillStyle='#0d9488';ctx.fillRect(pl.x,pl.y,pl.w,4);}
    });
    this.stars.forEach(s=>{
      if(s.collected)return;
      ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(s.x,s.y,8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff7';ctx.beginPath();ctx.arc(s.x-2,s.y-2,3,0,Math.PI*2);ctx.fill();
    });
    this.enemies.forEach(e=>{
      ctx.fillStyle='#dc2626';ctx.fillRect(e.x,e.y,e.w,e.h);
      ctx.fillStyle='#fff';ctx.fillRect(e.x+5,e.y+6,6,6);ctx.fillRect(e.x+17,e.y+6,6,6);
      ctx.fillStyle='#000';ctx.fillRect(e.x+7,e.y+8,3,3);ctx.fillRect(e.x+19,e.y+8,3,3);
    });
    const p=this.player;
    ctx.fillStyle='#0d9488';ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.fillStyle='#a0f0e0';ctx.fillRect(p.x+6,p.y+8,8,8);ctx.fillRect(p.x+22,p.y+8,8,8);
    ctx.fillStyle='#0f766e';ctx.fillRect(p.x+8,p.y+10,4,4);ctx.fillRect(p.x+24,p.y+10,4,4);
    const legOffset=Math.floor(this.frameCount/4)%2===0?4:-4;
    ctx.fillStyle='#1e40af';
    ctx.fillRect(p.x+4,p.y+p.h,10,10+legOffset);ctx.fillRect(p.x+p.w-14,p.y+p.h,10,10-legOffset);
    ctx.restore();
  }

  @HostListener('window:keydown',['$event'])
  onKeyDown(e:KeyboardEvent) {
    this.keys[e.key]=true;
    if((e.key==='ArrowUp'||e.key===' ')&&!this.jumpPressed){
      this.jumpPressed=true;e.preventDefault();
      if(!this.started){this.startGame();return;}
      this.doJump();
    }
  }
  @HostListener('window:keyup',['$event'])
  onKeyUp(e:KeyboardEvent){this.keys[e.key]=false;if(e.key==='ArrowUp'||e.key===' ')this.jumpPressed=false;}
}
