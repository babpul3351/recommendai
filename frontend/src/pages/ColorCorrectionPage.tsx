import React, { useState, useRef, useEffect } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { colorAssistantAPI, userAPI } from '../api/api';
import BeforeAfterSlider from '../components/BeforeAfterSlider';

const COLOR_TYPE_LABELS: Record<string, string> = {
    'normal': '정상 색각',
    'protanopia': '제1색맹 (적색맹)',
    'deuteranopia': '제2색맹 (녹색맹)',
    'tritanopia': '제3색맹 (청황색맹)',
};

const STYLE_LABELS: Record<string, string> = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트',
};

interface WarnItem { colors: string[]; name: string; desc: string; }
interface WarnData { label: string; items: WarnItem[]; }
const COLOR_TYPE_WARN: Record<string, WarnData | null> = {
    protanopia: { label: '적색맹 주의 색상 조합', items: [
        { colors: ['#8b0000', '#1a1a1a'], name: '다크레드 + 블랙', desc: '빨간색이 어둡게 보여서 검정과 거의 같아 보일 수 있어요.' },
        { colors: ['#cc3333', '#2d8c3c'], name: '빨강 + 초록', desc: '빨강이 탁하게 느껴져서 초록과 헷갈리기 쉬운 조합이에요.' },
        { colors: ['#8b1a2a', '#556b2f'], name: '와인 + 카키', desc: '두 색 모두 어둡고 탁해서 상하의 구분이 잘 안 될 수 있어요.' },
    ]},
    deuteranopia: { label: '녹색맹 주의 색상 조합', items: [
        { colors: ['#cc3333', '#2d8c3c'], name: '빨강 + 초록', desc: '이 두 색이 비슷한 색으로 보여서 코디 포인트가 사라질 수 있어요.' },
        { colors: ['#8B4513', '#228B22'], name: '갈색 + 짙은 초록', desc: '어둡고 탁한 색끼리라 입었을 때 경계가 흐릿하게 보일 수 있어요.' },
        { colors: ['#6f7448', '#d8c8a2'], name: '카키 + 베이지', desc: '카키가 갈색처럼 보여서 베이지와 구분이 어려울 수 있어요.' },
    ]},
    tritanopia: { label: '청황색맹 주의 색상 조합', items: [
        { colors: ['#1a66cc', '#f0c040'], name: '블루 + 옐로우', desc: '두 색이 비슷한 밝기로 느껴져 구분이 어려울 수 있어요.' },
        { colors: ['#2563eb', '#7c3aed'], name: '파랑 + 보라', desc: '파란 계열끼리라 하나로 뭉쳐 보일 수 있어요.' },
        { colors: ['#0f9992', '#98e2d2'], name: '청록 + 민트', desc: '비슷한 느낌의 색이라 경계가 흐릿해 보일 수 있어요.' },
    ]},
    normal: null,
};

interface PaletteItem { name: string; colors: string[]; desc: string; }
interface StylePalette { label: string; palettes: PaletteItem[]; }
const STYLE_COLOR_PALETTES: Record<string, StylePalette> = {
    business: { label: '비즈니스', palettes: [
        { name: '클래식 네이비', colors: ['#1a2a5e', '#ffffff', '#c0c0c0'], desc: '남색 + 흰색 + 실버' },
        { name: '차콜 그레이', colors: ['#36454f', '#f5f5f5', '#8b7355'], desc: '차콜 + 아이보리 + 베이지' },
    ]},
    formal: { label: '포멀', palettes: [
        { name: '모노크롬', colors: ['#1a1a1a', '#888888', '#f0f0f0'], desc: '블랙 + 그레이 + 화이트' },
        { name: '네이비 클래식', colors: ['#1a2a5e', '#c9a84c', '#ffffff'], desc: '네이비 + 골드 + 화이트' },
    ]},
    casual: { label: '캐주얼', palettes: [
        { name: '어스톤', colors: ['#8B6914', '#D2B48C', '#F5DEB3'], desc: '브라운 + 베이지 + 크림' },
        { name: '데님 믹스', colors: ['#1560BD', '#f5f5f5', '#c0392b'], desc: '블루 + 화이트 + 레드 포인트' },
    ]},
    lovely: { label: '러블리', palettes: [
        { name: '핑크 로맨틱', colors: ['#FFB6C1', '#ffffff', '#C8A2C8'], desc: '라이트핑크 + 화이트 + 라일락' },
        { name: '파스텔 믹스', colors: ['#FADADD', '#B0E0E6', '#FFFACD'], desc: '파스텔 핑크 + 파우더 블루 + 레몬' },
    ]},
    feminine: { label: '페미닌', palettes: [
        { name: '로즈 & 누드', colors: ['#C9707A', '#F5CBA7', '#ffffff'], desc: '로즈 + 누드 + 화이트' },
        { name: '버건디 클래식', colors: ['#800020', '#f5f5f5', '#D4AF37'], desc: '버건디 + 아이보리 + 골드' },
    ]},
    sporty: { label: '스포티', palettes: [
        { name: '모노 스포티', colors: ['#1a1a1a', '#ffffff', '#FF4500'], desc: '블랙 + 화이트 + 오렌지 레드' },
        { name: '네온 믹스', colors: ['#1a1a1a', '#39FF14', '#ffffff'], desc: '블랙 + 네온그린 + 화이트' },
    ]},
    comfort: { label: '컴포트', palettes: [
        { name: '뉴트럴 컴포트', colors: ['#D3D3D3', '#F5F5DC', '#A9A9A9'], desc: '라이트그레이 + 베이지 + 그레이' },
        { name: '웜 베이지', colors: ['#F5DEB3', '#D2B48C', '#8B7355'], desc: '크림 + 베이지 + 탄' },
    ]},
};

interface DaltonizeResult { original: string; simulated: string; corrected: string; }

type Tab = 'viewer' | 'guide';

function ColorCorrectionPage() {
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [colorType] = useState<string>(localStorage.getItem('colorType') || '');
    const [profileStyles, setProfileStyles] = useState<string[]>([]);
    const [daltonizeResult, setDaltonizeResult] = useState<DaltonizeResult | null>(null);
    const [daltonizing, setDaltonizing] = useState(false);
    const [tab, setTab] = useState<Tab>('viewer');

    const isColorDeficient = colorType && colorType !== 'normal';

    useEffect(() => {
        userAPI.getProfile()
            .then(res => setProfileStyles(res.data.styles || []))
            .catch(() => {});
    }, []);

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

    const tabs: { key: Tab; label: string }[] = [
        { key: 'viewer', label: '색상 보정' },
        ...(isColorDeficient ? [{ key: 'guide' as Tab, label: '색상 조합 가이드' }] : []),
    ];

    const warnData = isColorDeficient ? COLOR_TYPE_WARN[colorType] : null;

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 1100, width: '100%', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>
                    색상 보정 뷰어
                </h1>
                <p style={{ fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                    의류 이미지 보정과 내 색각 유형에 맞는 색상 조합 가이드를 확인해보세요
                </p>
            </div>

            {/* 색각 유형 배지 */}
            <div style={{
                background: 'rgba(113,179,229,0.07)', border: '1px solid rgba(113,179,229,0.2)',
                borderRadius: 12, padding: '12px 18px', marginBottom: 24,
                display: 'inline-flex', alignItems: 'center', gap: 10,
            }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#71b3e5' }}>내 색각 유형</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                    {COLOR_TYPE_LABELS[colorType] || '미설정'}
                </span>
            </div>

            {/* Tab bar — 내옷장 동일 스타일 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f0f2f5', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {tabs.map(({ key, label }) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                background: active ? 'white' : 'transparent',
                                border: 'none', borderRadius: 9, padding: '8px 24px',
                                fontWeight: active ? 600 : 400, fontSize: 14,
                                color: active ? '#1a1a2e' : '#888', cursor: 'pointer',
                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── 색상 보정 탭 ── */}
            {tab === 'viewer' && (
                <div>
                    <div style={{ background: 'white', borderRadius: 20, padding: '28px', border: '1px solid #eaedf2', marginBottom: 20 }}>
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
                                    padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
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

                    <div style={{ background: 'rgba(113,179,229,0.06)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(113,179,229,0.15)' }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#71b3e5', margin: '0 0 6px' }}>이용 안내</p>
                        <ul style={{ fontSize: 13, color: '#888', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                            <li>왼쪽은 색각 이상자 시점에서 보이는 색감입니다.</li>
                            <li>오른쪽은 AI가 정상 색각으로 보정한 결과입니다.</li>
                            <li>슬라이더를 드래그해서 두 이미지를 비교할 수 있습니다.</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* ── 색상 조합 가이드 탭 ── */}
            {tab === 'guide' && isColorDeficient && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* 주의 색상 조합 */}
                    {warnData && (
                        <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2' }}>
                            <h3 style={{ fontWeight: 700, fontSize: 16, color: '#e74c3c', margin: '0 0 6px' }}>
                                ⚠️ {warnData.label}
                            </h3>
                            <p style={{ fontSize: 13, color: '#888', margin: '0 0 18px' }}>
                                색각 유형에 따라 아래 색상 조합은 코디 시 주의해주세요.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                                {warnData.items.map((item, i) => (
                                    <div key={i} style={{ background: '#FFF5F5', borderRadius: 14, padding: '16px 18px', border: '1px solid #FECACA' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: 0 }}>{item.name}</p>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {item.colors.map((c, ci) => (
                                                    <div key={ci} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                                ))}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 스타일 색상 조합 추천 */}
                    <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2' }}>
                        <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: '0 0 6px' }}>
                            내 스타일 색상 조합 추천
                        </h3>
                        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
                            선호 스타일을 기반으로 어울리는 색상 조합을 추천드려요
                        </p>

                        {profileStyles.length === 0 ? (
                            <p style={{ fontSize: 14, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>
                                마이페이지에서 선호 스타일을 설정해주세요.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {profileStyles.map(styleKey => {
                                    const palette = STYLE_COLOR_PALETTES[styleKey];
                                    if (!palette) return null;
                                    return (
                                        <div key={styleKey}>
                                            <p style={{ fontWeight: 600, fontSize: 13, color: '#888', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid #eaedf2' }}>
                                                {STYLE_LABELS[styleKey]} 스타일 추천 색상
                                            </p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                                {palette.palettes.map((p, pi) => (
                                                    <div key={pi} style={{ background: '#f8f9fc', borderRadius: 14, padding: '16px 18px', border: '1px solid #eaedf2' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <p style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{p.name}</p>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                {p.colors.map((c, ci) => (
                                                                    <div key={ci} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: c, border: ['#ffffff', '#f5f5f5', '#f5f0dc', '#f5f0e8'].includes(c) ? '1px solid #e0e0e0' : 'none', flexShrink: 0 }} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ColorCorrectionPage;
