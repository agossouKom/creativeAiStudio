import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="features">
      <div class="header">
        <h2>Enterprise <span class="gradient-text">Capabilities</span></h2>
        <p>Everything you need for document processing at scale.</p>
      </div>
      
      <div class="grid">
        @for (feature of features; track feature.title) {
          <div class="premium-card">
            <div class="icon">{{ feature.icon }}</div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .features {
      padding: 8rem 4rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 4rem;
    }
    .header h2 {
      font-size: 3rem;
      font-weight: 800;
    }
    .gradient-text {
      background: linear-gradient(135deg, #6366f1, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }
    .icon {
      font-size: 2.5rem;
      margin-bottom: 1.5rem;
    }
    h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    p {
      color: #94a3b8;
      line-height: 1.6;
    }
  `]
})
export class FeaturesComponent {
  features = [
    { icon: '📄', title: 'PDF Manipulation', description: 'Merge, split, compress, and secure your documents with enterprise-grade performance.' },
    { icon: '🔍', title: 'OCR Intelligence', description: 'Extract text from scans and images with 99.9% accuracy using advanced Python microservices.' },
    { icon: '🤖', title: 'AI Insights', description: 'Chat with your documents, summarize long reports, and extract key data points automatically.' },
    { icon: '⚡', title: 'Fast Conversion', description: 'Convert between Word, Excel, PowerPoint, and PDF in seconds without losing formatting.' }
  ];
}
