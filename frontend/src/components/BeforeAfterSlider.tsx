// src/components/BeforeAfterSlider.tsx
//
// 변경 사항 (2026-11-09, 색상 보정 뷰어 접근성 개선)
// ------------------
// 1. 키보드 조작: 슬라이더에 포커스 후 ← → (5%씩), Home / End (0% / 100%)
// 2. 화면 낭독기 정보: role="slider", aria-valuenow, aria-label
// 3. fit 속성 추가 ('cover' 기본값 = 기존과 동일, 'contain' = 이미지 전체가 보이게). 마이페이지 등 기존 사용처는 변경 없음
// 4. 위쪽 라벨 대비 개선 (흰 글자 + 앱 하늘색을 어둡게 한 #2b6a9e 배경, 대비 5.7:1. 기존 하늘색 배경은 약 2.3:1)

import React, { useState, useRef, useCallback } from 'react';

interface Props {
    before: string;       // 왼쪽 이미지 src (보정 전)
    after: string;        // 오른쪽 이미지 src (보정 후)
    beforeLabel?: string;
    afterLabel?: string;
    height?: number;
    borderRadius?: number;
    fit?: 'cover' | 'contain';
}

export default function BeforeAfterSlider({
                                              before,
                                              after,
                                              beforeLabel = '원본',
                                              afterLabel = '보정 후',
                                              height = 240,
                                              borderRadius = 16,
                                              fit = 'cover',
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

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = 5;
        let next: number | null = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = sliderPos - step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = sliderPos + step;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = 100;
        if (next === null) return;
        e.preventDefault();
        setSliderPos(Math.min(100, Math.max(0, next)));
    };

    const imgStyle: React.CSSProperties = {
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, pointerEvents: 'none',
    };
    const labelStyle: React.CSSProperties = {
        position: 'absolute', top: 10, color: 'white', fontSize: 12, fontWeight: 700,
        padding: '4px 10px', borderRadius: 999, pointerEvents: 'none',
    };

    return (
        <div
            ref={containerRef}
            role="slider"
            tabIndex={0}
            aria-label={`${beforeLabel}와 ${afterLabel} 비교 슬라이더. 왼쪽 오른쪽 화살표로 이동`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sliderPos)}
            aria-valuetext={`${beforeLabel} ${Math.round(sliderPos)}%`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
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
            <img src={after} alt={afterLabel} draggable={false} style={imgStyle} />

            {/* 왼쪽: 원본 (clip-path로 오른쪽 잘라냄) */}
            <img
                src={before}
                alt={beforeLabel}
                draggable={false}
                style={{ ...imgStyle, clipPath: `inset(0 ${100 - sliderPos}% 0 0)`, willChange: 'clip-path' }}
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
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
                        <path d="M5 7H1M1 7L4 4M1 7L4 10" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 7H17M17 7L14 4M17 7L14 10" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>

            {/* 레이블 */}
            <span style={{ ...labelStyle, left: 10, background: 'rgba(26,26,46,0.78)' }}>{beforeLabel}</span>
            <span style={{ ...labelStyle, right: 10, background: '#2b6a9e' }}>{afterLabel}</span>
        </div>
    );
}