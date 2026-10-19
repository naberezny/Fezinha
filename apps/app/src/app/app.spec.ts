import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
  });

  async function renderizar(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renderiza ion-app com o outlet de rotas', async () => {
    // Arrange / Act
    const compiled = await renderizar();

    // Assert
    expect(compiled.querySelector('ion-app')).toBeTruthy();
    expect(compiled.querySelector('ion-router-outlet')).toBeTruthy();
  });

  it('não tem navegação própria: barra superior e tab bar ficam na tela inicial e na casca de cada jogo', async () => {
    // Arrange / Act
    const compiled = await renderizar();

    // Assert
    expect(compiled.querySelector('header')).toBeNull();
    expect(compiled.querySelector('ion-tab-bar')).toBeNull();
    expect(compiled.querySelector('ion-tabs')).toBeNull();
  });
});
