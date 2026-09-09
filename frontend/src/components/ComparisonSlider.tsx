import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getDaltonizedImageUrl, ColorType } from '../daltonization';

interface Props {
    src: string;
    colorType: ColorType;
    height?: number;
    borderRadius?: number;
}

export default function ComparisonSlider({ src, colorType, height = 260, borderRadius = 16 }: Props) {
    const [correctedSrc, setCorrectedSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sliderPos, setSliderPos] = useState(50); // 0~100 (%)
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        setCorrectedSrc(null);
        getDaltonizedImageUrl(src, colorType)
            .then(setCorrectedSrc)
            .catch(() => setCorrectedSrc(null))
            .finally(() => setLoading(false));
    }, [src, colorType]);

    const calcPos = useCallback((clientX: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pos = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
        setSliderPos(pos);
    }, []);

    // Pointer Events로 마우스·터치 통합 처리
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        calcPos(e.clientX);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.buttons === 0) return; // 버튼 안 눌린 상태면 무시
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
            {/* 오른쪽: 원본 이미지 (배경) */}
            <img
                src={src}
                alt="원본"
                draggable={false}
                style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                }}
            />

            {/* 왼쪽: 보정 이미지 (clip-path로 오른쪽 잘라냄) */}
            {correctedSrc && (
                <img
                    src={correctedSrc}
                    alt="보정"
                    draggable={false}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                        willChange: 'clip-path',
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* 구분선 */}
            <div
                style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${sliderPos}%`,
                    width: 2,
                    background: 'white',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 6px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                }}
            >
                {/* 드래그 핸들 */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 36, height: 36,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 3,
                }}>
                    {/* 좌우 화살표 아이콘 */}
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        <path d="M5 7H1M1 7L4 4M1 7L4 10" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 7H17M17 7L14 4M17 7L14 10" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>

            {/* 레이블 */}
            <span style={{
                position: 'absolute', top: 10, left: 10,
                background: 'rgba(113,179,229,0.85)', color: 'white',
                fontSize: 11, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                pointerEvents: 'none',
            }}>
                보정
            </span>
            <span style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.45)', color: 'white',
                fontSize: 11, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                pointerEvents: 'none',
            }}>
                원본
            </span>

            {/* 로딩 오버레이 */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius,
                }}>
                    <span style={{ fontSize: 13, color: '#71b3e5', fontWeight: 600 }}>
                        보정 중...
                    </span>
                </div>
            )}
        </div>
    );
}
