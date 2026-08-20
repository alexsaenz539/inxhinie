import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { createHeroScrollAnimation } from './hero-scroll.animation';

@Component({
  selector: 'app-public',
  templateUrl: './public.component.html',
})
export class PublicComponent implements AfterViewInit, OnDestroy {
  private destroyHeroAnimation: (() => void) | undefined;

  ngAfterViewInit() {
    this.destroyHeroAnimation = createHeroScrollAnimation();
  }

  ngOnDestroy() {
    this.destroyHeroAnimation?.();
  }
}
