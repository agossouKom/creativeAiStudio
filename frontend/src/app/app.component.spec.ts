import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      // AppComponent injecte Router et rend un <router-outlet> : sans provider,
      // TestBed.createComponent échoue sur l'injection de Router.
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialise the text scale within bounds', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.textScale).toBeGreaterThanOrEqual(app.TEXT_SCALE_MIN);
    expect(app.textScale).toBeLessThanOrEqual(app.TEXT_SCALE_MAX);
  });

  it('should render the navigation shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // AppComponent n'a plus de champ `title` ni de <h1>Hello, frontend</h1> :
    // c'est un shell de navigation. On vérifie ce qui existe réellement.
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});