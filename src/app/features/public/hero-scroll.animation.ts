import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function createHeroScrollAnimation(): () => void {
  const section = document.querySelector<HTMLElement>('[data-hero-scroll]');
  const image = document.querySelector<HTMLElement>('[data-hero-image]');
  const card = document.querySelector<HTMLElement>('[data-hero-card]');
  const scene = document.querySelector<HTMLElement>('[data-hero-scene]');
  const glow = document.querySelector<HTMLElement>('[data-hero-glow]');
  const beam = document.querySelector<HTMLElement>('[data-hero-beam]');
  const hud = document.querySelector<HTMLElement>('[data-hero-hud]');
  const hotspots = document.querySelectorAll<HTMLElement>('[data-hotspot]');
  const mobile = window.matchMedia('(max-width: 768px)').matches;

  if (!section || !image || !card || !scene || !glow || !beam || !hud || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }

  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: scene,
        pinSpacing: false,
        anticipatePin: 1,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    gsap.set(image, { transformOrigin: '58% 52%', filter: 'brightness(0.78) saturate(0.88)' });
    gsap.set(card, { autoAlpha: 0, y: 28 });
    gsap.set([glow, beam], { autoAlpha: 0 });
    gsap.set(hud, { autoAlpha: 0, y: -8 });
    gsap.set(hotspots, { autoAlpha: 0, scale: 0.85 });

    timeline
      .to(image, { scale: mobile ? 1.03 : 1.06, filter: 'brightness(1.02) saturate(0.98)', duration: 0.25 }, 0.1)
      .to(hud, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.12)
      .to([glow, beam], { autoAlpha: 1, duration: 0.2 }, 0.25)
      .to(glow, { scale: 1.15, xPercent: 5, yPercent: -3, duration: 0.3 }, 0.25)
      .to(image, { scale: mobile ? 1.1 : 1.16, xPercent: mobile ? 0 : 2, yPercent: mobile ? -1 : -1.5, filter: 'brightness(1.22) saturate(1.08)', duration: 0.3 }, 0.25);

    if (mobile) {
      timeline
        .to(hotspots[0], { autoAlpha: 1, scale: 1, duration: 0.1 }, 0.38)
        .to(hotspots[0], { autoAlpha: 0, y: -12, duration: 0.08 }, 0.5)
        .to(hotspots[1], { autoAlpha: 1, scale: 1, duration: 0.1 }, 0.53)
        .to(hotspots[1], { autoAlpha: 0, y: -12, duration: 0.08 }, 0.65)
        .to(hotspots[2], { autoAlpha: 1, scale: 1, duration: 0.1 }, 0.68)
        .to(hotspots[2], { autoAlpha: 0, y: -12, duration: 0.08 }, 0.8)
        .to(card, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.82)
        .to(card, { autoAlpha: 0, y: -14, duration: 0.08 }, 0.93)
        .to([glow, beam, hud], { autoAlpha: 0, duration: 0.06 }, 0.94)
        .to(image, { scale: 1.15, yPercent: -2, filter: 'brightness(0.86) saturate(0.92)', duration: 0.06 }, 0.95);
    } else {
      timeline
        .to(hotspots[0], { autoAlpha: 1, scale: 1, duration: 0.12 }, 0.4)
        .to(hotspots[1], { autoAlpha: 1, scale: 1, duration: 0.12 }, 0.52)
        .to(card, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.6)
        .to(hotspots[2], { autoAlpha: 1, scale: 1, duration: 0.12 }, 0.68)
        .to(image, { scale: 1.24, xPercent: 3.5, yPercent: -3, filter: 'brightness(1.3) saturate(1.12)', duration: 0.22 }, 0.7)
        .to([card, ...hotspots], { autoAlpha: 0, y: -14, duration: 0.1 }, 0.88)
        .to([glow, beam, hud], { autoAlpha: 0, duration: 0.06 }, 0.92)
        .to(image, { filter: 'brightness(0.86) saturate(0.92)', duration: 0.05 }, 0.95);
    }

    ScrollTrigger.refresh();
    image.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }, scene);

  return () => context.revert();
}
