import { useEffect, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function usePageAnimation(containerRef: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            // h1 reveal — parent must have overflow:hidden
            const h1 = el.querySelector('h1');
            if (h1) {
                tl.from(h1, { y: '110%', duration: 0.9 });
            }

            // subtitle
            const sub = el.querySelector('[data-sub]');
            if (sub) {
                tl.from(sub, { y: 24, opacity: 0, duration: 0.65 }, '-=0.55');
            }

            // above-fold cards — stagger
            const cards = el.querySelectorAll('[data-card]');
            if (cards.length > 0) {
                tl.from('[data-card]', {
                    y: 48,
                    opacity: 0,
                    duration: 0.6,
                    stagger: 0.09,
                }, '-=0.45');
            }

            // below-fold cards — scroll-triggered
            el.querySelectorAll('[data-scroll-card]').forEach((card) => {
                gsap.from(card, {
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 90%',
                        toggleActions: 'play none none none',
                    },
                    y: 38,
                    opacity: 0,
                    duration: 0.55,
                    ease: 'power2.out',
                });
            });
        }, containerRef);

        return () => ctx.revert();
    }, []);
}
