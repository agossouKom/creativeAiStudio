import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const GROUND_Y_RATIO = 0.75;

interface Obstacle { x:number;w:number;h:number; }

@Component({
  selector: 'app-game-dino',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🦕 Dino Run</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cvs (click)="onAction()"></canvas>
          <div class="gp-overlay" *ngIf="gameState==='over'">
            <div class="gp-overlay-icon">🦕</div>
            <div class="gp-overlay-title">Game Over !</div>
            <div class="gp-overlay-score">Score : {{score}}</div>
            <button class="gp-btn" (click)="startGame()">Rejouer</button>
          </div>
          <div class="gp-overlay" *ngIf="gameState==='idle'">
            <div class="gp-overlay-icon">🦕</div>
            <div class="gp-overlay-title">Dino Run</div>
            <div class="gp-overlay-sub">Saute par-dessus les obstacles !</div>
            <button class="gp-btn" (click)="startGame()">Courir !</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">Espace</span> Sauter</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑</span> Sauter</div>
            <div class="gp-ctrl-row"><span class="gp-key">Clic</span> Sauter</div>
            <div class="gp-ctrl-row"><span class="gp-key">Tap</span> Sauter</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">À propos</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Runner infini classique. La vitesse augmente progressivement. Bats ton record !</p>
          </div>
          <button class="jump-btn" (touchstart)="onAction()">⬆ Sauter</button>
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
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3),0 0 120px rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.3);cursor:pointer}
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
    .jump-btn{padding:12px;border-radius:10px;border:1px solid rgba(13,148,136,.4);background:rgba(13,148,136,.15);color:#0d9488;font-size:14px;font-weight:700;cursor:pointer;width:100%}
  `]
})
export class GameDinoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  score = 0; best = 0;
  gameState: 'idle'|'running'|'over' = 'idle';

  private W = 640; private H = 240;
  private GROUND_Y = 180;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;
  private dino = { x:80, y:this.GROUND_Y, vy:0, w:44, h:52, onGround:true };
  private obstacles: Obstacle[] = [];
  private speed = 5; private frameCount = 0; private spawnIn = 80; private legFrame = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const h = Math.min(window.innerHeight-80, 280);
    const w = Math.min(window.innerWidth-240, 700);
    this.W = w; this.H = h;
    this.GROUND_Y = Math.round(h * GROUND_Y_RATIO);
    const cv = this.cvsRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    this.best = parseInt(localStorage.getItem('dino-best')||'0',10);
    this.dino.y = this.GROUND_Y;
    this.drawFrame();
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  onAction() {
    if (this.gameState==='idle'||this.gameState==='over'){ this.startGame(); return; }
    this.jump();
  }

  @HostListener('window:keydown',['$event'])
  onKey(e:KeyboardEvent) {
    if(e.key===' '||e.key==='ArrowUp'){e.preventDefault();if(this.gameState==='idle'||this.gameState==='over'){this.startGame();return;}this.jump();}
  }

  private jump() { if(this.dino.onGround){this.dino.vy=-14;this.dino.onGround=false;} }

  startGame() {
    this.dino={x:80,y:this.GROUND_Y,vy:0,w:44,h:52,onGround:true};
    this.obstacles=[];this.speed=5;this.frameCount=0;this.spawnIn=80;this.score=0;
    this.gameState='running';
    this.cdr.detectChanges();
    cancelAnimationFrame(this.raf);
    this.raf=requestAnimationFrame(()=>this.loop());
  }

  private loop() { this.update();this.drawFrame();if(this.gameState==='running')this.raf=requestAnimationFrame(()=>this.loop()); }

  private update() {
    this.frameCount++;this.score=Math.floor(this.frameCount/6);
    this.speed=5+this.frameCount/400;
    this.dino.vy+=0.7;this.dino.y+=this.dino.vy;
    if(this.dino.y>=this.GROUND_Y){this.dino.y=this.GROUND_Y;this.dino.vy=0;this.dino.onGround=true;}
    this.legFrame=Math.floor(this.frameCount/6)%2;
    this.spawnIn--;
    if(this.spawnIn<=0){
      const h=30+Math.random()*40;
      this.obstacles.push({x:this.W+10,w:18+Math.random()*14,h});
      this.spawnIn=60+Math.floor(Math.random()*80);
    }
    this.obstacles.forEach(o=>o.x-=this.speed);
    this.obstacles=this.obstacles.filter(o=>o.x+o.w>0);
    for(const o of this.obstacles){
      if(this.dino.x+this.dino.w-8>o.x&&this.dino.x+8<o.x+o.w&&this.dino.y+this.dino.h>this.H-40-o.h){
        this.endGame();return;
      }
    }
  }

  private endGame() {
    this.gameState='over';
    if(this.score>this.best){this.best=this.score;localStorage.setItem('dino-best',String(this.best));}
    this.cdr.detectChanges();
    this.drawFrame();
  }

  private drawFrame() {
    const ctx=this.ctx,W=this.W,H=this.H,GY=this.GROUND_Y;
    ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#1e293b';ctx.fillRect(0,H-40,W,40);
    ctx.fillStyle='#0d9488';ctx.fillRect(0,H-40,W,3);
    ctx.fillStyle='rgba(255,255,255,0.05)';
    for(let i=0;i<15;i++){const gx=((i*53+this.frameCount*Math.floor(this.speed))%W);ctx.fillRect(gx,H-38,20+(i*7%20),2);}
    ctx.fillStyle='#dc2626';
    this.obstacles.forEach(o=>{
      const oy=H-40-o.h;
      ctx.fillRect(o.x,oy,o.w,o.h);
      ctx.fillRect(o.x-8,oy+o.h*.3,8,o.h*.25);
      ctx.fillRect(o.x+o.w,oy+o.h*.4,8,o.h*.25);
      ctx.fillStyle='rgba(220,38,38,0.3)';ctx.fillRect(o.x+2,oy,o.w-4,o.h);
      ctx.fillStyle='#dc2626';
    });
    const d=this.dino;
    const dinoScreenY=H-40-d.h+(d.y-GY);
    ctx.fillStyle='#059669';ctx.fillRect(d.x,dinoScreenY,d.w,d.h);
    ctx.fillStyle='#a7f3d0';ctx.fillRect(d.x+d.w-12,dinoScreenY+8,10,10);
    ctx.fillStyle='#000';ctx.fillRect(d.x+d.w-10,dinoScreenY+10,5,5);
    ctx.fillStyle='#a7f3d0';ctx.fillRect(d.x+d.w-8,dinoScreenY+d.h-14,8,5);
    if(d.onGround){
      ctx.fillStyle='#047857';
      if(this.legFrame===0){ctx.fillRect(d.x+6,dinoScreenY+d.h,10,12);ctx.fillRect(d.x+d.w-20,dinoScreenY+d.h-8,10,8);}
      else{ctx.fillRect(d.x+6,dinoScreenY+d.h-8,10,8);ctx.fillRect(d.x+d.w-20,dinoScreenY+d.h,10,12);}
    }else{ctx.fillStyle='#047857';ctx.fillRect(d.x+6,dinoScreenY+d.h,10,8);ctx.fillRect(d.x+d.w-20,dinoScreenY+d.h,10,8);}
    ctx.fillStyle='#059669';ctx.fillRect(d.x-14,dinoScreenY+10,14,10);
  }
}
