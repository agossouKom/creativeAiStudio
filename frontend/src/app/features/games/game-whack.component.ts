import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-game-whack',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🔨 Whack-a-Bug</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Temps</span><span class="gp-score-value" [style.color]="timeLeft<=10?'#dc2626':'#0d9488'">{{timeLeft}}s</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="wk-center">
          <div class="gp-overlay-wrap" *ngIf="!gameStarted && !gameOver">
            <div class="gp-overlay-inl">
              <div class="gp-overlay-icon">🔨</div>
              <div class="gp-overlay-title">Whack-a-Bug</div>
              <div class="gp-overlay-sub">Tape sur les bugs avant qu'ils disparaissent !</div>
              <button class="gp-btn" (click)="startGame()">Lancer</button>
            </div>
          </div>
          <div class="grid" *ngIf="gameStarted || gameOver">
            <div class="hole" *ngFor="let h of holes; let i = index"
              (click)="whack(i)" [class.hole--active]="bugs[i]">
              <div class="hole-bg"></div>
              <div class="bug" *ngIf="bugs[i]" [class.bug--hit]="hits[i]">🐛</div>
            </div>
          </div>
          <div class="gp-overlay-inl" *ngIf="gameOver">
            <div class="gp-overlay-icon">⏱️</div>
            <div class="gp-overlay-title">Temps écoulé !</div>
            <div class="gp-overlay-score">Score : {{score}}</div>
            <div style="font-size:13px;color:#f59e0b;font-weight:700" *ngIf="score===best&&score>0">🏆 Nouveau record !</div>
            <button class="gp-btn" (click)="startGame()">Rejouer</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row">Clic sur un bug pour l'éliminer</div>
            <div class="gp-ctrl-row">Fonctionne aussi au tactile !</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">À propos</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Élimine le plus de bugs possible en 30 secondes. La vitesse augmente !</p>
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
    .wk-center{display:flex;flex-direction:column;align-items:center;gap:20px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:440px;width:100%}
    .hole{position:relative;width:130px;height:130px;cursor:pointer;user-select:none}
    .hole-bg{width:100%;height:100%;border-radius:50%;background:rgba(15,23,42,.8);border:3px solid rgba(255,255,255,.06);transition:border-color .15s;box-shadow:inset 0 4px 12px rgba(0,0,0,.5)}
    .hole--active .hole-bg{border-color:rgba(13,148,136,.4);box-shadow:inset 0 4px 12px rgba(0,0,0,.5),0 0 20px rgba(13,148,136,.2)}
    .bug{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:60px;animation:bugUp .2s ease-out;cursor:pointer}
    .bug--hit{animation:bugHit .15s ease}
    .gp-overlay-wrap{display:flex;align-items:center;justify-content:center}
    .gp-overlay-inl{display:flex;flex-direction:column;align-items:center;gap:12px;background:rgba(10,14,26,.85);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px 48px;backdrop-filter:blur(8px)}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
    .gp-overlay-sub{font-size:14px;color:#64748b;text-align:center}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(13,148,136,.4);margin-top:8px;transition:transform .1s}
    .gp-btn:hover{transform:translateY(-2px)}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{font-size:12px;color:#94a3b8;margin-bottom:4px}
    @keyframes bugUp{0%{transform:translateY(60%) scale(.5);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
    @keyframes bugHit{0%{transform:scale(1.3) rotate(-10deg)}100%{transform:scale(0) rotate(20deg);opacity:0}}
  `]
})
export class GameWhackComponent implements OnInit, OnDestroy {
  holes = Array(9).fill(null);
  bugs: boolean[] = Array(9).fill(false);
  hits: boolean[] = Array(9).fill(false);
  score = 0; best = 0; timeLeft = 30;
  gameStarted = false; gameOver = false;

  private timerId: ReturnType<typeof setInterval>|null = null;
  private bugTimers: ReturnType<typeof setTimeout>[] = [];
  private spawnInterval = 1000;
  private spawnTimer: ReturnType<typeof setTimeout>|null = null;

  ngOnInit() { this.best = parseInt(localStorage.getItem('whack-best')||'0',10); }
  ngOnDestroy() { this.clearTimers(); }

  startGame() {
    this.clearTimers(); this.score=0; this.timeLeft=30;
    this.bugs=Array(9).fill(false); this.hits=Array(9).fill(false);
    this.gameStarted=true; this.gameOver=false; this.spawnInterval=1000;
    this.timerId=setInterval(()=>{
      this.timeLeft--;
      if(this.timeLeft%8===0&&this.spawnInterval>400)this.spawnInterval=Math.max(400,this.spawnInterval-150);
      if(this.timeLeft<=0){this.clearTimers();this.gameOver=true;this.gameStarted=false;if(this.score>this.best){this.best=this.score;localStorage.setItem('whack-best',String(this.best));}}
    },1000);
    this.scheduleSpawn();
  }

  private scheduleSpawn() {
    this.spawnTimer=setTimeout(()=>{this.spawnBug();if(this.gameStarted)this.scheduleSpawn();},this.spawnInterval+Math.random()*300);
  }

  private spawnBug() {
    const available=this.bugs.map((b,i)=>b?-1:i).filter(i=>i>=0);
    if(!available.length)return;
    const idx=available[Math.floor(Math.random()*available.length)];
    this.bugs[idx]=true;
    const duration=Math.max(600,1200-(30-this.timeLeft)*20);
    const t=setTimeout(()=>{this.bugs[idx]=false;},duration);
    this.bugTimers.push(t);
  }

  whack(i:number) {
    if(!this.gameStarted||!this.bugs[i])return;
    this.score+=10; this.hits[i]=true; this.bugs[i]=false;
    setTimeout(()=>{this.hits[i]=false;},200);
  }

  private clearTimers() {
    if(this.timerId){clearInterval(this.timerId);this.timerId=null;}
    if(this.spawnTimer){clearTimeout(this.spawnTimer);this.spawnTimer=null;}
    this.bugTimers.forEach(t=>clearTimeout(t));this.bugTimers=[];
  }
}
