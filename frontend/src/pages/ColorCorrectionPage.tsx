// 변경 사항 (2026-11-09, v3)
// ------------------
// 1. 사진 업로드 시 색각 보정(daltonize)과 색상 무드보드 요청을 동시에 보냄 (무드보드는 1280px로 줄여 전송)
// 2. 결과 화면 구성: 결과 바로가기(고정) -> 보정 비교 -> 이 옷의 색 -> 옷장에서 찾기 -> 무드보드
// 3. 보정 비교: "원본과 비교"(본인용, 색각 이상이면 기본값) / "색약자 시점과 비교"(함께 보는 사람용) 선택
// 4. 실제 색 / 보정 색 전환은 페이지에서 관리하고 결과 전체에 적용 (처음 값은 프로필의 보정 토글)
// 5. 접근성: 글자 대비 4.5:1 이상 색만 사용, 버튼/탭 키보드 포커스 표시, 드래그 앤 드롭 업로드,
//    슬라이더 키보드 조작, 화면 낭독기용 라벨, 움직임 줄이기 설정 존중
// 6. 페이지에 들어오면 옷장 색 백그라운드 분석을 미리 시작
// 색상 조합 가이드 탭은 내용은 그대로 두고 대비/아이콘만 정리 (⚠️ 이모지 -> 아이콘)

import React, { useState, useRef, useEffect } from 'react';
import { Eye, ImagePlus, Upload, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { colorAssistantAPI, userAPI, MoodboardResponse } from '../api/api';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import ColorMoodboardSection, { ResultNav, CcStyle, CC, ColorView } from '../components/ColorMoodboardSection';

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

type CompareMode = 'original' | 'simulated';

// 무드보드 요청용으로 사진을 줄임 (색 추출에는 큰 해상도가 필요 없고, 전송/처리 시간을 줄이기 위함)
function resizeDataUrl(dataUrl: string, maxSide = 1280): Promise<string> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            if (scale >= 1) { resolve(dataUrl); return; }
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dataUrl); return; }
            ctx.fillStyle = '#ffffff';   // 투명 PNG는 흰 배경으로
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function moodboardErrorMessage(err: any): string {
    const msg = err?.response?.data?.message;
    return typeof msg === 'string' && msg ? msg : '색 분석을 하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: 20, padding: '26px 28px', border: `1px solid ${CC.border}`, marginBottom: 20, scrollMarginTop: 90,
};
const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: CC.brandFill,
    color: CC.onBrand, border: 'none', borderRadius: 999, fontSize: 14.5, cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 4px 12px rgba(113,179,229,0.35)',
};
const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'white',
    color: CC.brandText, border: `1.5px solid ${CC.brand}`, borderRadius: 999, fontSize: 14, cursor: 'pointer', fontWeight: 600,
};

function ColorCorrectionPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [colorType] = useState<string>(localStorage.getItem('colorType') || '');
    const [profileStyles, setProfileStyles] = useState<string[]>([]);
    const [daltonizeResult, setDaltonizeResult] = useState<DaltonizeResult | null>(null);
    const [daltonizing, setDaltonizing] = useState(false);
    const [tab, setTab] = useState<Tab>('viewer');
    const [correctionEnabled, setCorrectionEnabled] = useState(false);
    const [moodboard, setMoodboard] = useState<MoodboardResponse | null>(null);
    const [moodLoading, setMoodLoading] = useState(false);
    const [moodError, setMoodError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [view, setView] = useState<ColorView>('real');
    const lastImageRef = useRef<string | null>(null);
    const requestSeq = useRef(0);   // 연달아 업로드했을 때 늦게 온 이전 결과를 무시하기 위함

    const isColorDeficient = !!colorType && colorType !== 'normal';
    // 색각 이상 사용자 본인에게는 "원본 ↔ 보정"이 의미 있고, "색약자 시점"은 함께 보는 사람에게 의미가 있음
    const [compareMode, setCompareMode] = useState<CompareMode>(isColorDeficient ? 'original' : 'simulated');

    useEffect(() => {
        userAPI.getProfile()
            .then(res => {
                setProfileStyles(res.data.styles || []);
                setCorrectionEnabled(!!res.data.correctionEnabled);
            })
            .catch(() => {});
        // 옷장 색 백그라운드 분석 시작 (이미 분석된 옷은 건너뜀. 실패해도 화면 동작에는 영향 없음)
        colorAssistantAPI.analyzeWardrobeColors().catch(() => {});
    }, []);

    const runMoodboard = async (dataUrl: string, seq: number) => {
        setMoodLoading(true);
        setMoodError(null);
        setMoodboard(null);
        try {
            const small = await resizeDataUrl(dataUrl);
            const res = await colorAssistantAPI.moodboard(small);
            if (seq !== requestSeq.current) return;
            const canCorrect = res.data.colorType !== 'normal' && res.data.palette.some(p => !!p.correctedHex);
            setView(canCorrect && correctionEnabled ? 'corrected' : 'real');
            setMoodboard(res.data);
        } catch (err) {
            if (seq === requestSeq.current) setMoodError(moodboardErrorMessage(err));
        } finally {
            if (seq === requestSeq.current) setMoodLoading(false);
        }
    };

    const processFile = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 올릴 수 있어요.');
            return;
        }
        setDaltonizeResult(null);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const seq = ++requestSeq.current;
            lastImageRef.current = dataUrl;
            setPreview(dataUrl);
            runMoodboard(dataUrl, seq);   // 보정과 동시에 진행 (결과는 따로 표시)
            setDaltonizing(true);
            try {
                const res = await colorAssistantAPI.daltonize(dataUrl, colorType);
                if (seq === requestSeq.current) setDaltonizeResult(res.data);
            } catch {
                if (seq === requestSeq.current) alert('보정 처리에 실패했습니다.');
            } finally {
                if (seq === requestSeq.current) setDaltonizing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        processFile(file);
    };

    const dropHandlers = {
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
        onDragLeave: () => setDragOver(false),
        onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files?.[0]); },
    };

    const retryMoodboard = () => {
        if (lastImageRef.current) runMoodboard(lastImageRef.current, requestSeq.current);
    };

    const hasUpload = !!preview;
    const canCorrect = !!moodboard && moodboard.colorType !== 'normal' && moodboard.palette.some(p => !!p.correctedHex);

    const tabs: { key: Tab; label: string }[] = [
        { key: 'viewer', label: '색상 보정' },
        ...(isColorDeficient ? [{ key: 'guide' as Tab, label: '색상 조합 가이드' }] : []),
    ];

    const warnData = isColorDeficient ? COLOR_TYPE_WARN[colorType] : null;

    return (
        <div className="cc-scope" style={{ padding: '70px 36px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
            <CcStyle />

            {/* Header */}
            <header style={{ marginBottom: 20 }}>
                <h1 style={{ fontWeight: 700, fontSize: 28, color: CC.text, margin: 0, letterSpacing: '-0.5px' }}>색상 보정 뷰어</h1>
                <p style={{ fontWeight: 400, fontSize: 15, color: CC.sub, margin: '6px 0 0' }}>
                    옷 사진의 색을 보정해 비교하고, 색 이름과 설명, 내 옷장 속 같은 색 옷까지 확인해 보세요
                </p>
            </header>

            {/* 색각 유형 + 탭 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={{ background: CC.blueBg, borderRadius: 12, padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Eye size={16} color={CC.blueText} aria-hidden />
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: CC.blueText }}>내 색각 유형</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: CC.text }}>{COLOR_TYPE_LABELS[colorType] || '미설정'}</span>
                </div>
                <div role="tablist" aria-label="색상 보정 뷰어 메뉴" style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 12, padding: 4 }}>
                    {tabs.map(({ key, label }) => {
                        const active = tab === key;
                        return (
                            <button key={key} role="tab" aria-selected={active} onClick={() => setTab(key)} style={{
                                background: active ? 'white' : 'transparent', border: 'none', borderRadius: 9, padding: '8px 22px',
                                fontWeight: active ? 700 : 500, fontSize: 14, color: active ? CC.text : CC.sub, cursor: 'pointer',
                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                            }}>{label}</button>
                        );
                    })}
                </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

            {/* ── 색상 보정 탭 ── */}
            {tab === 'viewer' && (
                <div>
                    {/* 업로드 */}
                    {!hasUpload ? (
                        <div
                            {...dropHandlers}
                            role="button"
                            tabIndex={0}
                            aria-label="옷 사진 올리기. 클릭하거나 사진을 끌어다 놓으세요"
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                            style={{
                                ...cardStyle, cursor: 'pointer', textAlign: 'center', padding: '48px 24px',
                                border: `2px dashed ${dragOver ? CC.brand : '#d0dbe8'}`, background: dragOver ? CC.blueBg : 'white',
                            }}
                        >
                            <span aria-hidden style={{ width: 56, height: 56, borderRadius: 16, background: CC.blueBg, color: CC.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImagePlus size={26} />
                            </span>
                            <p style={{ fontSize: 18, fontWeight: 700, color: CC.text, margin: '14px 0 6px' }}>옷 사진을 올려 주세요</p>
                            <p style={{ fontSize: 14, color: CC.sub, margin: '0 0 18px' }}>클릭해서 고르거나, 사진을 여기로 끌어다 놓으세요</p>
                            <span style={btnPrimary}><Upload size={16} aria-hidden />사진 선택</span>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
                                {['보정 전후 비교', '색 이름과 설명', '헷갈리는 색 알림', '내 옷장에서 같은 색 찾기'].map(t => (
                                    <span key={t} style={{ fontSize: 12.5, fontWeight: 600, color: CC.grayText, background: CC.grayBg, padding: '5px 12px', borderRadius: 999 }}>{t}</span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div {...dropHandlers} style={{
                            ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                            border: `1px solid ${dragOver ? CC.brand : CC.border}`, background: dragOver ? CC.blueBg : 'white',
                        }}>
                            <img src={preview!} alt="올린 옷 사진" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12, border: `1px solid ${CC.border}` }} />
                            <div style={{ flex: 1, minWidth: 160 }}>
                                <p style={{ fontSize: 15, fontWeight: 700, color: CC.text, margin: 0 }}>올린 사진</p>
                                <p style={{ fontSize: 13, color: CC.sub, margin: '2px 0 0' }}>
                                    {daltonizing || moodLoading ? '분석 중이에요...' : '다른 사진을 끌어다 놓아도 바로 분석해요'}
                                </p>
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} style={btnSecondary}><RefreshCw size={15} aria-hidden />다른 사진 올리기</button>
                        </div>
                    )}

                    {moodboard && (
                        <ResultNav view={view} setView={setView} canCorrect={canCorrect} colorTypeLabel={moodboard.colorTypeLabel} />
                    )}

                    {/* 보정 비교 */}
                    {hasUpload && (
                        <section id="cc-compare" style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                                <div>
                                    <h2 style={{ fontWeight: 700, fontSize: 19, color: CC.text, margin: 0 }}>보정 비교</h2>
                                    <p style={{ fontSize: 13.5, color: CC.sub, margin: '6px 0 0', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                                        {compareMode === 'original'
                                            ? '왼쪽은 원본, 오른쪽은 내 색각에 맞춰 구분하기 쉽게 바꾼 보정 이미지예요.'
                                            : '왼쪽은 색각 이상이 있을 때 보이는 모습(시뮬레이션)이에요. 함께 보는 사람이 차이를 이해할 때 도움이 돼요.'}
                                        {' '}가운데 손잡이를 끌거나, 슬라이더를 선택하고 ← → 키로 움직일 수 있어요.
                                    </p>
                                </div>
                                <div role="group" aria-label="비교 대상" style={{ display: 'flex', gap: 3, background: '#f0f2f5', borderRadius: 11, padding: 3 }}>
                                    {([['original', '원본과 비교'], ['simulated', '색약자 시점과 비교']] as [CompareMode, string][]).map(([m, label]) => {
                                        const active = compareMode === m;
                                        return (
                                            <button key={m} aria-pressed={active} onClick={() => setCompareMode(m)} style={{
                                                border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                                                fontWeight: active ? 700 : 500, color: active ? CC.text : CC.sub, background: active ? 'white' : 'transparent',
                                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                            }}>{label}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            {daltonizing && (
                                <div role="status" style={{ height: 300, borderRadius: 14, background: CC.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: CC.sub }}>
                                    보정 이미지를 만드는 중이에요...
                                </div>
                            )}
                            {!daltonizing && daltonizeResult && (
                                <BeforeAfterSlider
                                    before={compareMode === 'original' ? daltonizeResult.original : daltonizeResult.simulated}
                                    after={daltonizeResult.corrected}
                                    beforeLabel={compareMode === 'original' ? '원본' : '색약자 시점'}
                                    afterLabel="보정 후"
                                    height={480}
                                    borderRadius={14}
                                    fit="contain"
                                />
                            )}
                            {!daltonizing && !daltonizeResult && (
                                <p style={{ fontSize: 14, color: CC.sub, margin: 0 }}>보정 이미지를 만들지 못했어요. 다른 사진으로 다시 시도해 주세요.</p>
                            )}
                        </section>
                    )}

                    {(moodLoading || moodError || moodboard) && (
                        <ColorMoodboardSection
                            loading={moodLoading}
                            error={moodError}
                            data={moodboard}
                            colorType={colorType}
                            view={canCorrect ? view : 'real'}
                            onRetry={retryMoodboard}
                        />
                    )}

                    <div style={{ background: CC.soft, borderRadius: 16, padding: '16px 20px', border: `1px solid ${CC.border}`, display: 'flex', gap: 10 }}>
                        <Info size={16} color={CC.sub} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                        <div>
                            <p style={{ fontWeight: 700, fontSize: 14, color: CC.text, margin: '0 0 6px' }}>이용 안내</p>
                            <ul style={{ fontSize: 13.5, color: CC.sub, margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                                <li>"원본과 비교"는 원본과 보정 이미지를, "색약자 시점과 비교"는 색각 이상 시뮬레이션과 보정 이미지를 비교해요.</li>
                                <li>"실제 색"은 옷의 실제 색, "보정 색"은 보정 이미지와 같은 방식으로 구분하기 쉽게 바꾼 색이에요.</li>
                                <li>색 값과 색 설명은 사진 픽셀에서 계산하고, 색 이름 일부와 장면 설명은 AI(Gemini)가 만들어요.</li>
                                <li>조명과 촬영 환경에 따라 사진 속 색이 실제 옷 색과 다를 수 있어요.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 색상 조합 가이드 탭 ── */}
            {tab === 'guide' && isColorDeficient && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* 주의 색상 조합 */}
                    {warnData && (
                        <section style={{ ...cardStyle, marginBottom: 0 }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18, color: CC.warnText, margin: '0 0 6px' }}>
                                <AlertTriangle size={18} aria-hidden />{warnData.label}
                            </h2>
                            <p style={{ fontSize: 14, color: CC.sub, margin: '0 0 18px' }}>
                                색각 유형에 따라 아래 색상 조합은 코디 시 주의해주세요.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                                {warnData.items.map((item, i) => (
                                    <div key={i} style={{ background: CC.warnBg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${CC.warnBorder}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                                            <p style={{ fontWeight: 700, fontSize: 14, color: CC.text, margin: 0 }}>{item.name}</p>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {item.colors.map((c, ci) => (
                                                    <div key={ci} role="img" aria-label={c} title={c} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                                                ))}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 13, color: CC.sub, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 스타일 색상 조합 추천 */}
                    <section style={{ ...cardStyle, marginBottom: 0 }}>
                        <h2 style={{ fontWeight: 700, fontSize: 18, color: CC.text, margin: '0 0 6px' }}>내 스타일 색상 조합 추천</h2>
                        <p style={{ fontSize: 14, color: CC.sub, margin: '0 0 20px' }}>선호 스타일을 기반으로 어울리는 색상 조합을 추천드려요</p>

                        {profileStyles.length === 0 ? (
                            <p style={{ fontSize: 14, color: CC.sub, textAlign: 'center', padding: '24px 0' }}>마이페이지에서 선호 스타일을 설정해주세요.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {profileStyles.map(styleKey => {
                                    const palette = STYLE_COLOR_PALETTES[styleKey];
                                    if (!palette) return null;
                                    return (
                                        <div key={styleKey}>
                                            <p style={{ fontWeight: 700, fontSize: 14, color: CC.sub, margin: '0 0 12px', paddingBottom: 8, borderBottom: `1px solid ${CC.border}` }}>
                                                {STYLE_LABELS[styleKey]} 스타일 추천 색상
                                            </p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                                                {palette.palettes.map((p, pi) => (
                                                    <div key={pi} style={{ background: CC.soft, borderRadius: 14, padding: '16px 18px', border: `1px solid ${CC.border}` }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                            <p style={{ fontWeight: 700, fontSize: 14, color: CC.text, margin: 0 }}>{p.name}</p>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                {p.colors.map((c, ci) => (
                                                                    <div key={ci} role="img" aria-label={c} title={c} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p style={{ fontSize: 13, color: CC.sub, margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

export default ColorCorrectionPage;