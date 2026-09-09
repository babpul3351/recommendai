import React, { useState, useRef, useCallback } from 'react';

interface Props {
    before: string;       // 왼쪽 이미지 src (보정 전)
    after: string;        // 오른쪽 이미지 src (보정 후)
    beforeLabel?: string;
    afterLabel?: string;
    height?: number;
    borderRadius?: number;
}

export default function BeforeAfterSlider({
    before,
    after,
    beforeLabel = '원본',
    afterLabel = '보정 후',
    height = 240,
    borderRadius = 16,
}: Props) {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const calcPos = useCallback((clientX: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setSliderPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
    }, []);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        calcPos(e.clientX);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.buttons === 0) return;
        calcPos(e.clientX);
    };

    return (
        <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            style={{
                position: 'relative',
                width: '100%',
                height,
                borderRadius,
                overflow: 'hidden',
                userSelect: 'none',
                cursor: 'ew-resize',
                touchAction: 'none',
                background: '#f0f0f0',
            }}
        >
            {/* 오른쪽: 보정 후 (배경) */}
            <img
                src={after}
                alt={afterLabel}
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            />

            {/* 왼쪽: 원본 (clip-path로 오른쪽 잘라냄) */}
            <img
                src={before}
                alt={beforeLabel}
                draggable={false}
                style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                    clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                    willChange: 'clip-path',
                    pointerEvents: 'none',
                }}
            />

            {/* 구분선 */}
            <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${sliderPos}%`, width: 2,
                background: 'white', transform: 'translateX(-50%)',
                boxShadow: '0 0 6px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
            }}>
                {/* 핸들 */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        <path d="M5 7H1M1 7L4 4M1 7L4 10" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 7H17M17 7L14 4M17 7L14 10" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>

            {/* 레이블 */}
            <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, pointerEvents: 'none' }}>
                {beforeLabel}
            </span>
            <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(113,179,229,0.85)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, pointerEvents: 'none' }}>
                {afterLabel}
            </span>
        </div>
    );
}
