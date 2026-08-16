import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  template: `
    <section class="hero">
      <div class="container">
        <h1 class="title">Doc<span class="gradient-text">Fusion</span></h1>
        <p class="subtitle">The Enterprise-Grade SaaS for PDF, OCR, and AI Intelligence.</p>
        <div class="cta-group">
          <button class="btn-primary">Get Started</button>
          <button class="btn-outline">View Demo</button>
        </div>
      </div>
      <div class="scroll-indicator">
        <div class="mouse"></div>
      </div>
    </section>
  `,
  styles: [`
    .hero {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      position: relative;
    }
    .title {
      font-size: 5rem;
      font-weight: 800;
      margin-bottom: 1rem;
      letter-spacing: -2px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #6366f1, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 1.5rem;
      color: #94a3b8;
      max-width: 600px;
      margin-bottom: 2.5rem;
    }
    .cta-group {
      display: flex;
      gap: 1.5rem;
    }
    .btn-outline {
      background: transparent;
      border: 2px solid rgba(255, 255, 255, 0.1);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .btn-outline:hover {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
    }
    .scroll-indicator {
      position: absolute;
      bottom: 2rem;
    }
    .mouse {
      width: 25px;
      height: 45px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 20px;
      position: relative;
    }
    .mouse::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 8px;
      background: white;
      border-radius: 2px;
      animation: scroll 2s infinite;
    }
    @keyframes scroll {
      0% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, 20px); }
    }
  `]
})
export class HeroComponent {}
