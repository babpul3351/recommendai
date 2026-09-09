import React, { useState, useRef, useEffect } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { colorAssistantAPI } from '../api/api';
import BeforeAfterSlider from '../components/BeforeAfterSlider';

const COLOR_TYPE_LABELS: Record<string, string> = {
    'normal': '정상 색각',
    'protanopia': '제1색맹 (적색맹)',
    'deuteranopia': '제2색맹 (녹색맹)',
    'tritanopia': '제3색맹 (청황색맹)',
};

interface DaltonizeResult { original: string; simulated: string; corrected: string; }

function ColorCorrectionPage() {
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [colorType] = useState<string>(localStorage.getItem('colorType') || '');
    const [daltonizeResult, setDaltonizeResult] = useState<DaltonizeResult | null>(null);
    const [daltonizing, setDaltonizing] = useState(false);

    const btnPrimary: React.CSSProperties = {
        padding: '10px 22px',
        background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
        color: 'white', border: 'none', borderRadius: 999,
        fontSize: 14, cursor: 'pointer', fontWeight: 600,
    };
    const btnSecondary: React.CSSProperties = {
        padding: '10px 22px',
        background: 'rgba(113,179,229,0.12)',
        color: '#71b3e5', border: 'none', borderRadius: 999,
        fontSize: 14, cursor: 'pointer', fontWeight: 500,
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setDaltonizeResult(null);
        const reader = new FileReader();
        reader.onloadend = async () => {
            setDaltonizing(true);
            try {
                const res = await colorAssistantAPI.daltonize(reader.result as string, colorType);
                setDaltonizeResult(res.data);
            } catch {
                alert('보정 처리에 실패했습니다.');
            } finally {
                setDaltonizing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 900, width: '100%' }}>
            <div style={{ marginBottom: 28 }}>
                <div style={{ overflow: 'hidden' }}>
                    <h1 style={{ fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>
                        색상 보정 뷰어
                    </h1>
                </div>
                <p data-sub style={{ fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                    의류 이미지를 업로드해서 색약자 시점과 보정 후를 비교해보세요
                </p>
            </div>

            {/* 색각 유형 배지 */}
            <div style={{
                background: 'rgba(113,179,229,0.07)',
                border: '1px solid rgba(113,179,229,0.2)',
                borderRadius: 14, padding: '14px 20px',
                marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#71b3e5' }}>내 색각 유형</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>
                    {COLOR_TYPE_LABELS[colorType] || '미설정'}
                </span>
            </div>

            {/* 업로드 카드 */}
            <div style={{
                background: 'white', borderRadius: 20,
                padding: '28px', border: '1px solid #eaedf2', marginBottom: 20,
            }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: daltonizeResult ? 20 : 0 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>
                        이미지 업로드
                    </button>
                    {daltonizeResult && (
                        <button onClick={() => fileInputRef.current?.click()} style={btnSecondary}>
                            다른 사진 보정하기
                        </button>
                    )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

                {daltonizing && (
                    <p style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 24 }}>보정 처리 중...</p>
                )}

                {!daltonizing && !daltonizeResult && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            marginTop: 20, border: '2px dashed #d0dbe8', borderRadius: 16,
                            padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                            background: '#f8fafc',
                        }}
                    >
                        <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>이미지를 클릭하거나 업로드 버튼을 눌러주세요</p>
                    </div>
                )}

                {daltonizeResult && (
                    <div>
                        <p style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 10 }}>
                            드래그해서 색약자 시점 ↔ 보정 후 비교
                        </p>
                        <BeforeAfterSlider
                            before={daltonizeResult.simulated}
                            after={daltonizeResult.corrected}
                            beforeLabel="색약자 시점"
                            afterLabel="보정 후"
                            height={480}
                            borderRadius={12}
                        />
                    </div>
                )}
            </div>

            {/* 안내 */}
            <div style={{
                background: 'rgba(113,179,229,0.06)',
                borderRadius: 14, padding: '16px 20px',
                border: '1px solid rgba(113,179,229,0.15)',
            }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#71b3e5', margin: '0 0 6px' }}>이용 안내</p>
                <ul style={{ fontSize: 13, color: '#888', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                    <li>왼쪽은 색각 이상자 시점에서 보이는 색감입니다.</li>
                    <li>오른쪽은 AI가 정상 색각으로 보정한 결과입니다.</li>
                    <li>슬라이더를 드래그해서 두 이미지를 비교할 수 있습니다.</li>
                </ul>
            </div>
        </div>
    );
}

export default ColorCorrectionPage;
