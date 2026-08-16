import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Asteroid { x:number;y:number;vx:number;vy:number;r:number;angle:number;spin:number;size:'big'|'med'|'small'; }
interface Bullet { x:number;y:number;vx:number;vy:number;life:number; }
interface Particle { x:number;y:number;vx:number;vy:number;life:number;color:string; }

@Component({
  selector: 'app-game-asteroid',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🚀 Asteroid Blaster</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Vies</span><span class="gp-score-value">{{lives}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cvs></canvas>
          <div class="gp-overlay" *ngIf="gameOver || !started">
            <div class="gp-overlay-icon">🚀</div>
            <div class="gp-overlay-title">{{gameOver ? 'Game Over' : 'Asteroid Blaster'}}</div>
            <div class="gp-overlay-score" *ngIf="gameOver">Score : {{score}}</div>
            <div class="gp-overlay-sub" *ngIf="!gameOver">← → Rotation · ↑ Propulsion · Espace Tir</div>
            <button class="gp-btn" (click)="startGame()">{{gameOver ? 'Rejouer' : 'Lancer'}}</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">←→</span> Rotation</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑</span> Propulsion</div>
            <div class="gp-ctrl-row"><span class="gp-key">Espace</span> Tirer</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Mobile</div>
            <div class="joy-btns">
              <button class="joy-btn" (touchstart)="keys['ArrowLeft']=true" (touchend)="keys['ArrowLeft']=false">↺</button>
              <button class="joy-btn" (touchstart)="keys['ArrowUp']=true" (touchend)="keys['ArrowUp']=false">▲</button>
              <button class="joy-btn" (touchstart)="keys['ArrowRight']=true" (touchend)="keys['ArrowRight']=false">↻</button>
            </div>
            <button class="joy-fire" (touchstart)="keys[' ']=true" (touchend)="keys[' ']=false">🔥 TIR</button>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">À propos</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Détruis tous les astéroïdes. Chaque vague est plus difficile !</p>
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
    .gp-overlay-sub{font-size:13px;color:#64748b;text-align:center}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .gp-btn:hover{transform:translateY(-2px)}
    .joy-btns{display:flex;gap:8px;justify-content:center;margin-bottom:8px}
    .joy-btn{width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#e2e8f0;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .joy-fire{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(220,38,38,.4);background:rgba(220,38,38,.15);color:#f87171;font-size:13px;font-weight:700;cursor:pointer}
  `]
})
export class GameAsteroidComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  score = 0; lives = 3; best = 0; gameOver = false; started = false;

  private W = 720; private H = 420;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;
  private ship = { x: 360, y: 210, angle: -Math.PI/2, vx: 0, vy: 0, invincible: 0 };
  private asteroids: Asteroid[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  keys: Record<string, boolean> = {};
  private shootCooldown = 0; private wave = 1;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const h = Math.min(window.innerHeight - 80, 440);
    const w = Math.min(window.innerWidth - 240, 760);
    this.W = w; this.H = h;
    const cv = this.cvsRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    this.ship.x = this.W/2; this.ship.y = this.H/2;
    this.drawIdle();
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  startGame() {
    this.score = 0; this.lives = 3; this.gameOver = false; this.started = true; this.wave = 1;
    this.best = parseInt(localStorage.getItem('asteroid-best')||'0',10);
    this.ship = { x: this.W/2, y: this.H/2, angle: -Math.PI/2, vx: 0, vy: 0, invincible: 180 };
    this.asteroids = []; this.bullets = []; this.particles = [];
    this.spawnWave();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(()=>this.loop());
    this.cdr.detectChanges();
  }

  private spawnWave() {
    for (let i = 0; i < 3+this.wave; i++) {
      let x: number, y: number;
      do { x = Math.random()*this.W; y = Math.random()*this.H; }
      while (Math.hypot(x-this.ship.x, y-this.ship.y) < 150);
      const angle = Math.random()*Math.PI*2;
      const speed = 0.5+Math.random()*1.5;
      this.asteroids.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:40,angle:0,spin:(Math.random()-.5)*.04,size:'big'});
    }
  }

  private loop() {
    if (this.gameOver) return;
    this.update(); this.drawScene();
    this.raf = requestAnimationFrame(()=>this.loop());
  }

  private update() {
    const W=this.W, H=this.H;
    if (this.keys['ArrowLeft'])  this.ship.angle -= 0.05;
    if (this.keys['ArrowRight']) this.ship.angle += 0.05;
    if (this.keys['ArrowUp']) { this.ship.vx += Math.cos(this.ship.angle)*.2; this.ship.vy += Math.sin(this.ship.angle)*.2; }
    this.ship.vx *= .98; this.ship.vy *= .98;
    const spd = Math.hypot(this.ship.vx,this.ship.vy);
    if (spd > 8) { this.ship.vx=this.ship.vx/spd*8; this.ship.vy=this.ship.vy/spd*8; }
    this.ship.x = (this.ship.x+this.ship.vx+W)%W;
    this.ship.y = (this.ship.y+this.ship.vy+H)%H;
    if (this.ship.invincible > 0) this.ship.invincible--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.keys[' '] && this.shootCooldown===0) {
      this.bullets.push({x:this.ship.x,y:this.ship.y,vx:Math.cos(this.ship.angle)*10,vy:Math.sin(this.ship.angle)*10,life:60});
      this.shootCooldown = 10;
    }
    this.bullets = this.bullets.filter(b=>{b.x=(b.x+b.vx+W)%W;b.y=(b.y+b.vy+H)%H;b.life--;return b.life>0;});
    this.asteroids.forEach(a=>{a.x=(a.x+a.vx+W)%W;a.y=(a.y+a.vy+H)%H;a.angle+=a.spin;});
    const toRemove:number[]=[], newAsteroids:Asteroid[]=[];
    this.bullets.forEach(b=>{
      this.asteroids.forEach((a,ai)=>{
        if (Math.hypot(b.x-a.x,b.y-a.y)<a.r) {
          if (!toRemove.includes(ai)) {
            toRemove.push(ai); b.life=0;
            this.score += a.size==='big'?20:a.size==='med'?50:100;
            this.explode(a.x,a.y,a.r);
            if (a.size==='big') newAsteroids.push(...this.split(a,'med',20));
            else if (a.size==='med') newAsteroids.push(...this.split(a,'small',10));
          }
        }
      });
    });
    this.asteroids = this.asteroids.filter((_,i)=>!toRemove.includes(i));
    this.asteroids.push(...newAsteroids);
    this.cdr.detectChanges();
    if (this.ship.invincible===0) {
      for (const a of this.asteroids) {
        if (Math.hypot(this.ship.x-a.x,this.ship.y-a.y)<a.r+12) {
          this.lives--;
          this.explode(this.ship.x,this.ship.y,20);
          if (this.lives<=0) { this.gameOver=true; if(this.score>this.best){this.best=this.score;localStorage.setItem('asteroid-best',String(this.best));} cancelAnimationFrame(this.raf); return; }
          this.ship={x:W/2,y:H/2,angle:-Math.PI/2,vx:0,vy:0,invincible:180};
        }
      }
    }
    this.particles=this.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.96;p.vy*=.96;p.life--;return p.life>0;});
    if (this.asteroids.length===0){this.wave++;this.spawnWave();}
  }

  private split(a:Asteroid,size:'med'|'small',r:number):Asteroid[] {
    return [0,1].map(()=>{const angle=Math.random()*Math.PI*2,speed=1+Math.random()*2;return{x:a.x,y:a.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r,angle:0,spin:(Math.random()-.5)*.06,size};});
  }
  private explode(x:number,y:number,r:number) {
    const colors=['#f97316','#fbbf24','#ef4444','#fff'];
    for(let i=0;i<20;i++){const angle=Math.random()*Math.PI*2,speed=Math.random()*r*.15;this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:40+Math.random()*20,color:colors[Math.floor(Math.random()*colors.length)]});}
  }
  private drawIdle() {
    if(!this.ctx)return;
    this.ctx.fillStyle='#0f172a';this.ctx.fillRect(0,0,this.W,this.H);
  }
  private drawScene() {
    const ctx=this.ctx,W=this.W,H=this.H;
    ctx.fillStyle='#050d1a';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.4)';
    for(let i=0;i<80;i++){ctx.fillRect((i*173+7)%W,(i*97+13)%H,1,1);}
    this.particles.forEach(p=>{ctx.globalAlpha=p.life/60;ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4);});
    ctx.globalAlpha=1;
    this.asteroids.forEach(a=>{
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);ctx.beginPath();
      for(let i=0;i<8;i++){const ang=(i/8)*Math.PI*2,rad=a.r*(0.8+0.2*Math.sin(i*1.7+a.x));i===0?ctx.moveTo(Math.cos(ang)*rad,Math.sin(ang)*rad):ctx.lineTo(Math.cos(ang)*rad,Math.sin(ang)*rad);}
      ctx.closePath();ctx.strokeStyle='#94a3b8';ctx.lineWidth=2;ctx.fillStyle='rgba(148,163,184,0.1)';ctx.fill();ctx.stroke();ctx.restore();
    });
    if (!this.gameOver) {
      if (this.ship.invincible%6<3||this.ship.invincible===0) {
        ctx.save();ctx.translate(this.ship.x,this.ship.y);ctx.rotate(this.ship.angle);
        ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-12,-10);ctx.lineTo(-8,0);ctx.lineTo(-12,10);ctx.closePath();
        ctx.fillStyle='#0d9488';ctx.fill();ctx.strokeStyle='#5eead4';ctx.lineWidth=1.5;ctx.stroke();
        if(this.keys['ArrowUp']){ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-16,-4);ctx.lineTo(-20,0);ctx.lineTo(-16,4);ctx.closePath();ctx.fillStyle='#f97316';ctx.fill();}
        ctx.restore();
      }
    }
    this.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fillStyle='#5eead4';ctx.fill();});
  }

  @HostListener('window:keydown',['$event']) onKeyDown(e:KeyboardEvent){this.keys[e.key]=true;if([' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();}
  @HostListener('window:keyup',['$event']) onKeyUp(e:KeyboardEvent){this.keys[e.key]=false;}
}
