import React, { useState, useEffect } from 'react';
import { getDaltonizedImageUrl } from '../daltonization';

interface DaltonizedImageProps {
    src: string;
    alt: string;
    colorType: string;
    correctionEnabled: boolean;
    style?: React.CSSProperties;
    imgStyle?: React.CSSProperties;
    className?: string;
}

/*
 * 변경 사항 (기존 대비)
 * ------------------
 * 컴포넌트 언마운트 시 Blob URL을 자동으로 해제(revokeObjectURL)하던
 * 로직을 제거했습니다.
 *
 * 이유: daltonization.js에 캐싱이 추가되면서, 같은 이미지의 Blob URL이
 * 여러 컴포넌트/여러 화면 진입에서 재사용됩니다. 기존처럼 언마운트 시
 * 자동 해제하면, 캐시에 저장된 URL이 무효화되어 다음에 캐시를 사용할 때
 * 깨진 이미지가 표시됩니다.
 *
 * Blob URL 해제는 이제 daltonization.js의 clearDaltonizationCache()가
 * 전담합니다. (예: 로그아웃 시점 등에서 필요하면 호출)
 */
export default function DaltonizedImage({
    src,
    alt,
    colorType,
    correctionEnabled,
    style,
    imgStyle,
    className
}: DaltonizedImageProps) {
    const [displaySrc, setDisplaySrc] = useState(src);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!correctionEnabled || !colorType || colorType === 'normal') {
            setDisplaySrc(src);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getDaltonizedImageUrl(src, colorType as 'protanopia' | 'deuteranopia' | 'tritanopia')
            .then((url) => {
                if (!cancelled) setDisplaySrc(url);
            })
            .catch(() => {
                if (!cancelled) setDisplaySrc(src);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        // Blob URL은 캐시가 소유하므로 여기서 revoke하지 않습니다.
        // 컴포넌트가 언마운트되어도 상태 업데이트만 막습니다.
        return () => {
            cancelled = true;
        };
    }, [src, colorType, correctionEnabled]);

    return (
        <div style={{ position: 'relative', ...style }}>
            <img
                src={displaySrc}
                alt={alt}
                className={className}
                style={{
                    ...imgStyle,
                    opacity: loading ? 0.5 : 1,
                    transition: 'opacity 0.2s'
                }}
            />
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.5)', borderRadius: 8
                }}>
                    <span style={{ fontSize: 12, color: '#2E8B6E', fontWeight: '600' }}>
                        보정 중...
                    </span>
                </div>
            )}
        </div>
    );
}