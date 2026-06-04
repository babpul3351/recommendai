import { useState, useEffect } from 'react';
import { getDaltonizedImageUrl } from '../daltonization';   // ← 경로 수정

export default function DaltonizedImage({
                                            src,
                                            alt,
                                            colorType,
                                            correctionEnabled,
                                            style,      // wrapper div 스타일
                                            imgStyle,   // img 태그 스타일 (추가)
                                            className
                                        }) {
    const [displaySrc, setDisplaySrc] = useState(src);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!correctionEnabled || !colorType || colorType === 'normal') {
            setDisplaySrc(src);
            return;
        }

        let objectUrl = null;
        setLoading(true);

        getDaltonizedImageUrl(src, colorType)
            .then((url) => {
                objectUrl = url;
                setDisplaySrc(url);
            })
            .catch(() => {
                setDisplaySrc(src);
            })
            .finally(() => setLoading(false));

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
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