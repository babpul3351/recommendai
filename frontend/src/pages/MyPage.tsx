import React, { useEffect, useState, useRef, useCallback } from 'react';
import { theme } from '../styles/theme';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { useNavigate } from 'react-router-dom';
import { userAPI, recommendationAPI, colorAssistantAPI, wardrobeAPI } from '../api/api';
import { SparkleIcon, WardrobeIcon, CalendarIcon, WarningIcon, CloseIcon } from '../components/Icons';

const STYLES = ['casual', 'formal', 'business', 'lovely', 'feminine', 'sporty', 'comfort'];
const STYLE_LABELS: Record<string, string> = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트',
};
const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대이상'];
const TABS = ['프로필', '색상 어시스턴트', '의류 순환 리포트'];

const TPO_COLORS: Record<string, string> = {
    '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
    '운동': '#F5A623', '파티': '#9B59B6', '여행': '#1ABC9C',
    '일상': '#95A5A6', '격식': '#34495E',
};

const COLOR_TYPE_LABELS: Record<string, string> = {
    'normal': '정상 색각', 'protanopia': '제1색맹 (적색맹)',
    'deuteranopia': '제2색맹 (녹색맹)', 'tritanopia': '제3색맹 (청황색맹)',
};
const COLOR_TYPE_DESCS: Record<string, string> = {
    'normal': '색각이 정상입니다.', 'protanopia': '빨간색 계열 구분이 어렵습니다.',
    'deuteranopia': '초록색 계열 구분이 어렵습니다.', 'tritanopia': '파란/노란색 계열 구분이 어렵습니다.',
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

interface Plate {
    id: number; text: string; isWord?: boolean; question: string; category: string;
    options: string[]; answer: string; weight: 'protan' | 'deutan' | 'tritan' | 'normal';
    bg: string[]; fg: string[];
}

const PLATES: Plate[] = [
    { id: 1, text: '29', question: '원 안의 숫자를 읽어주세요', category: '적록 판별', options: ['29', '70', '21', '보기 어려움'], answer: '29', weight: 'deutan', bg: ['#9eaa68', '#b0b977', '#8f9b5e', '#c0bd80'], fg: ['#bd694d', '#ca7a5a', '#a95743', '#d18a69'] },
    { id: 2, text: '45', question: '원 안의 숫자를 읽어주세요', category: '적색 판별', options: ['45', '15', '48', '보기 어려움'], answer: '45', weight: 'protan', bg: ['#c67a68', '#b9685c', '#d08d75', '#b75f51'], fg: ['#728f5b', '#668453', '#83a168', '#5a744a'] },
    { id: 3, text: '7', question: '원 안의 숫자를 읽어주세요', category: '청황 판별', options: ['7', '1', '3', '보기 어려움'], answer: '7', weight: 'tritan', bg: ['#c4b45f', '#d1c36f', '#b9a753', '#d8ca83'], fg: ['#536fab', '#46619b', '#657fba', '#3d558a'] },
    { id: 4, text: '12', question: '원 안의 숫자를 읽어주세요', category: '기준 확인', options: ['12', '17', '21', '보기 어려움'], answer: '12', weight: 'normal', bg: ['#d4bd72', '#c7a961', '#e0ca87', '#b99b58'], fg: ['#405c86', '#324b73', '#536f98', '#253d61'] },
    { id: 5, text: '5', question: '원 안의 숫자를 읽어주세요', category: '적색 판별', options: ['5', '6', '8', '보기 어려움'], answer: '5', weight: 'protan', bg: ['#cf9077', '#c57d6d', '#d9a08a', '#b96c60'], fg: ['#6f8d69', '#5e7c5e', '#82a17a', '#537052'] },
    { id: 6, text: 'RED', isWord: true, question: '원 안에 숨겨진 영단어를 찾아주세요', category: '적록 판별', options: ['RED', 'BED', 'REB', '보기 어려움'], answer: 'RED', weight: 'deutan', bg: ['#c8d090', '#b8c070', '#d8e0a0', '#e0e8b0', '#a8b860'], fg: ['#d06040', '#c04828', '#e07050', '#b83820'] },
    { id: 7, text: 'GO', isWord: true, question: '원 안에 숨겨진 영단어를 찾아주세요', category: '녹색 판별', options: ['GO', 'DO', '보이지 않음', '보기 어려움'], answer: 'GO', weight: 'protan', bg: ['#a8c8a8', '#98b898', '#b8d8b8', '#88a888', '#c0d8c0'], fg: ['#c04040', '#d05050', '#b03030', '#c84848'] },
    { id: 8, text: 'B', isWord: true, question: '원 안에 숨겨진 알파벳을 찾아주세요', category: '청황 판별', options: ['B', 'E', 'R', '보기 어려움'], answer: 'B', weight: 'tritan', bg: ['#a0c8e0', '#80b0d0', '#c0d8f0', '#b0c8e8', '#90b8d8'], fg: ['#e08020', '#d06010', '#f09030', '#c07008'] },
];

function createTextMask(W: number, text: string, isWord: boolean): CanvasRenderingContext2D {
    const mc = document.createElement('canvas'); mc.width = W; mc.height = W;
    const mctx = mc.getContext('2d')!;
    mctx.clearRect(0, 0, W, W); mctx.fillStyle = '#000';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    const fontSize = isWord ? (text.length === 1 ? Math.round(W * 0.62) : Math.round(W * 0.34)) : (text.length > 1 ? Math.round(W * 0.40) : Math.round(W * 0.52));
    mctx.font = `900 ${fontSize}px Arial, sans-serif`;
    mctx.fillText(text, W / 2, W / 2 + fontSize * 0.04);
    return mctx;
}
function isTextPixel(maskCtx: CanvasRenderingContext2D, x: number, y: number): boolean {
    try { return maskCtx.getImageData(Math.max(0, Math.min(Math.floor(x), maskCtx.canvas.width - 1)), Math.max(0, Math.min(Math.floor(y), maskCtx.canvas.height - 1)), 1, 1).data[3] > 16; }
    catch (e) { return false; }
}
function randColor(colors: string[]): string { return colors[Math.floor(Math.random() * colors.length)]; }
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colors: string[]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = randColor(colors); ctx.fill();
}
function randomInCircle(cx: number, cy: number, radius: number): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2, dist = Math.sqrt(Math.random()) * radius;
    return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
}

function ColorTest({ onResult }: { onResult: (result: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);
    const [rendered, setRendered] = useState(false);

    const drawPlate = useCallback((canvas: HTMLCanvasElement, plate: Plate) => {
        const W = canvas.width, cx = W / 2, cy = W / 2, radius = W * 0.45;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, W, W); ctx.fillStyle = '#f7fafc'; ctx.fillRect(0, 0, W, W);
        const mask = createTextMask(W, plate.text, plate.isWord || false);
        for (let i = 0; i < 1450; i++) { const p = randomInCircle(cx, cy, radius); drawDot(ctx, p.x, p.y, 5 + Math.random() * 9, plate.bg); }
        let drawn = 0, attempts = 0;
        while (drawn < 620 && attempts < 620 * 18) {
            attempts++;
            const p = randomInCircle(cx, cy, radius * 0.82);
            if (!isTextPixel(mask, p.x, p.y)) continue;
            drawDot(ctx, p.x, p.y, 7 + Math.random() * 10, plate.fg); drawn++;
        }
        for (let i = 0; i < 260; i++) {
            const p = randomInCircle(cx, cy, radius);
            const colors = isTextPixel(mask, p.x, p.y) ? plate.fg : plate.bg;
            drawDot(ctx, p.x, p.y, 3 + Math.random() * 5, colors);
        }
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#d7dee6'; ctx.stroke();
        setRendered(true);
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;
        setRendered(false);
        const raf = requestAnimationFrame(() => { if (canvasRef.current) drawPlate(canvasRef.current, PLATES[step]); });
        return () => cancelAnimationFrame(raf);
    }, [step, drawPlate]);

    const analyze = (ans: string[]) => {
        const miss: Record<'protan' | 'deutan' | 'tritan', number> = { protan: 0, deutan: 0, tritan: 0 };
        ans.forEach((a, i) => { const p = PLATES[i]; if (a !== p.answer && p.weight !== 'normal') miss[p.weight]++; });
        const total = ans.filter((a, i) => a === PLATES[i].answer).length;
        if (total >= PLATES.length - 1) { onResult('normal'); return; }
        const dominant = Object.entries(miss).sort((a, b) => b[1] - a[1])[0];
        if (dominant[1] === 0) { onResult('normal'); return; }
        if (dominant[0] === 'protan') { onResult('protanopia'); return; }
        if (dominant[0] === 'deutan') { onResult('deuteranopia'); return; }
        if (dominant[0] === 'tritan') { onResult('tritanopia'); return; }
        onResult('normal');
    };

    const handleAnswer = (opt: string) => {
        const newAns = [...answers, opt]; setAnswers(newAns);
        if (step + 1 >= PLATES.length) { analyze(newAns); }
        else { setRendered(false); setStep(step + 1); }
    };

    const plate = PLATES[step];
    const progress = Math.round(((step + 1) / PLATES.length) * 100);

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 5, backgroundColor: '#eaedf2', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', borderRadius: 4, transition: 'width 0.35s ease' }} />
                </div>
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap',  }}>{step + 1} / {PLATES.length}</span>
            </div>
            <div style={{ display: 'inline-block', padding: '3px 12px', background: 'rgba(113,179,229,0.12)', color: '#71b3e5', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 12,  }}>
                {plate.category}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', marginBottom: 18,  }}>{plate.question}</p>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                {!rendered && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7fafc', borderRadius: '50%', zIndex: 1 }}>
                        <span style={{ fontSize: 12, color: '#888',  }}>로딩 중...</span>
                    </div>
                )}
                <canvas ref={canvasRef} width={400} height={400} style={{ width: 220, height: 220, borderRadius: '50%', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plate.options.map(opt => (
                    <button key={opt} onClick={() => handleAnswer(opt)} style={{ width: '100%', padding: '13px 18px', border: '1.5px solid #eaedf2', borderRadius: 12, backgroundColor: 'white', fontSize: 15, fontWeight: 500, color: '#1a1a2e', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,  transition: 'border-color 0.15s' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #eaedf2', flexShrink: 0 }} />
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}


interface Profile { nickname: string; loginId: string; ageGroup: string; gender: string; colorType: string; styles: string[]; createdAt: string; }
interface EditForm { nickname: string; ageGroup: string; gender: string; colorType: string; styles: string[]; }
interface HistoryItem { id?: number; imageUrl?: string; type?: string; category?: string; }
interface OutfitInfo { style?: string; description?: string; }
interface HistoryRecord { recId: number; tpo: string; retryCount?: number; createdAt: string; outfitDate?: string; temperature?: number; weatherCondition?: string; description?: string; allOutfitGroups?: Record<string, HistoryItem[]>; outfitInfos?: Record<number, OutfitInfo>; acceptedOutfitIndex?: number; }
interface DaltonizeResult { original: string; simulated: string; corrected: string; }

function MyPage() {
    const navigate = useNavigate();
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState('프로필');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({ nickname: '', ageGroup: '', gender: '', colorType: '', styles: [] });
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [notifCodi, setNotifCodi] = useState(true);
    const [notifWeather, setNotifWeather] = useState(true);
    const [notifReport, setNotifReport] = useState(false);
    const [showColorTest, setShowColorTest] = useState(false);
    const [testActive, setTestActive] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [daltonizeResult, setDaltonizeResult] = useState<DaltonizeResult | null>(null);
    const [daltonizing, setDaltonizing] = useState(false);
    const [wardrobeItems, setWardrobeItems] = useState<{ id: number; category?: string; type?: string; color?: string }[]>([]);

    const fetchProfile = async () => {
        try {
            const res = await userAPI.getProfile();
            setProfile(res.data);
            setEditForm({ nickname: res.data.nickname, ageGroup: res.data.ageGroup, gender: res.data.gender, colorType: res.data.colorType, styles: res.data.styles || [] });
        } catch (err) { console.error(err); }
    };

    const fetchHistory = async () => {
        try { const res = await recommendationAPI.getHistory(); setHistory(res.data); }
        catch (err) { console.error(err); }
    };

    const fetchWardrobe = async () => {
        try { const res = await wardrobeAPI.getWardrobe(); setWardrobeItems(res.data); } catch {}
    };

    useEffect(() => { fetchProfile(); fetchHistory(); fetchWardrobe(); }, []);

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) { localStorage.clear(); navigate('/login'); }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await userAPI.updateProfile(editForm);
            localStorage.setItem('nickname', editForm.nickname);
            await fetchProfile(); setEditMode(false); alert('프로필이 수정됐습니다.');
        } catch (err) { alert('수정 실패'); }
        finally { setLoading(false); }
    };

    const toggleStyle = (style: string) => {
        if (editForm.styles.includes(style)) { setEditForm({ ...editForm, styles: editForm.styles.filter(s => s !== style) }); }
        else if (editForm.styles.length < 3) { setEditForm({ ...editForm, styles: [...editForm.styles, style] }); }
    };

    const handleSaveColorType = async (colorType: string) => {
        try {
            await colorAssistantAPI.updateColorType(colorType);
            await fetchProfile(); setShowColorTest(false); setTestActive(false); setTestResult(null);
            alert(`'${COLOR_TYPE_LABELS[colorType]}'으로 저장됐습니다.`);
        } catch (err) { alert('저장 실패'); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = ''; setDaltonizeResult(null);
        const reader = new FileReader();
        reader.onloadend = async () => {
            setDaltonizing(true);
            try { const res = await colorAssistantAPI.daltonize(reader.result as string, profile?.colorType || ''); setDaltonizeResult(res.data); }
            catch (err) { alert('보정 처리에 실패했습니다.'); }
            finally { setDaltonizing(false); }
        };
        reader.readAsDataURL(file);
    };

    const formatDate = (datetime: string): string => {
        if (!datetime) return '';
        return new Date(datetime).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!profile) return (
        <div style={{ padding: '32px 36px' }}>
            <p style={{ textAlign: 'center', marginTop: 60, color: '#888',  }}>불러오는 중...</p>
        </div>
    );

    const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 20, padding: '24px 28px', border: '1px solid #eaedf2', marginBottom: 20 };
    const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', color: 'white', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer',  fontWeight: 600 };
    const btnSecondary: React.CSSProperties = { padding: '8px 18px', background: 'rgba(113,179,229,0.12)', color: '#71b3e5', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer',  fontWeight: 500 };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, boxSizing: 'border-box',  marginBottom: 10 };

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 1100, width: '100%' }}>
            <div style={{ marginBottom: 28 }}>
                <div style={{ overflow: 'hidden' }}>
                    <h1 style={{  fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>마이페이지</h1>
                </div>
                <p data-sub style={{  fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>계정과 앱 설정을 관리하세요</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
                {/* Left: Profile card */}
                <div>
                    <div data-card style={{ ...cardStyle, overflow: 'hidden', padding: 0 }}>
                        <div style={{ height: 80, background: 'linear-gradient(135deg, #71b3e5, #b0cbe0)' }} />
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #5a9fd4, #bae3ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '4px solid white', marginTop: -36, marginBottom: 12 }}>
                                {profile.nickname?.charAt(0).toUpperCase()}
                            </div>
                            <h2 style={{  fontWeight: 700, fontSize: 20, color: '#1a1a2e', margin: 0 }}>{profile.nickname}</h2>
                            <p style={{  fontWeight: 400, fontSize: 13, color: '#aaa', margin: '4px 0 16px' }}>@{profile.loginId}</p>
                            <button onClick={handleLogout} style={{ width: '100%', background: 'none', border: '1px solid #ffcdd2', borderRadius: 10, padding: 10,  fontWeight: 600, fontSize: 13, color: '#e57373', cursor: 'pointer' }}>
                                로그아웃
                            </button>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div style={cardStyle}>
                        <h3 style={{  fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: '0 0 16px' }}>나의 통계</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'AI 추천 횟수', value: history.length, Icon: SparkleIcon, color: '#71b3e5' },
                                { label: '선호 스타일 수', value: (profile.styles || []).length, Icon: WardrobeIcon, color: '#e625c6' },
                                { label: '가입일', value: formatDate(profile.createdAt), Icon: CalendarIcon, color: '#84c98e' },
                            ].map(({ label, value, Icon, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8f9fc', borderRadius: 12 }}>
                                    <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon color={color} size={20} />
                                    </span>
                                    <span style={{  fontWeight: 400, fontSize: 13, color: '#555', flex: 1 }}>{label}</span>
                                    <span style={{  fontWeight: 700, fontSize: 13, color }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notification settings */}
                    <div style={cardStyle}>
                        <h3 style={{  fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: '0 0 4px' }}>알림 설정</h3>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {([
                                { key: 'codi', label: '코디 추천 알림', desc: '매일 아침 오늘의 코디를 알려드려요', state: notifCodi, toggle: () => setNotifCodi(p => !p) },
                                { key: 'weather', label: '날씨 변화 알림', desc: '갑작스러운 날씨 변화 시 알림', state: notifWeather, toggle: () => setNotifWeather(p => !p) },
                                { key: 'report', label: '의류 순환 리포트', desc: '매달 나의 의류를 분석한 결과를 보내드려요', state: notifReport, toggle: () => setNotifReport(p => !p) },
                            ] as const).map(({ key, label, desc, state, toggle }, i, arr) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                        <p style={{  fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{label}</p>
                                        <p style={{  fontWeight: 400, fontSize: 12, color: '#aaa', margin: '4px 0 0' }}>{desc}</p>
                                    </div>
                                    <button
                                        onClick={toggle}
                                        style={{ width: 44, height: 24, borderRadius: 12, background: state ? '#71b3e5' : '#d0d5dd', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                                    >
                                        <div style={{ position: 'absolute', top: 2, left: state ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Tabs */}
                <div>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', background: 'white', borderRadius: 14, padding: 4, border: '1px solid #eaedf2', marginBottom: 20, gap: 4 }}>
                        {TABS.map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{
                                flex: 1, padding: '11px', background: tab === t ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'none',
                                border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                                 fontWeight: tab === t ? 700 : 400,
                                color: tab === t ? 'white' : '#888', transition: 'all 0.15s',
                            }}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* 프로필 tab */}
                    {tab === '프로필' && (
                        <div style={cardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{  fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: 0 }}>내 프로필</h3>
                                {!editMode ? (
                                    <button onClick={() => setEditMode(true)} style={btnSecondary}>수정</button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={handleSave} disabled={loading} style={btnPrimary}>{loading ? '저장 중...' : '저장'}</button>
                                        <button onClick={() => setEditMode(false)} style={{ ...btnSecondary, color: '#888', background: '#f5f7fa' }}>취소</button>
                                    </div>
                                )}
                            </div>

                            {!editMode ? (
                                <div>
                                    {[
                                        { label: '닉네임', value: profile.nickname },
                                        { label: '아이디', value: profile.loginId },
                                        { label: '연령대', value: profile.ageGroup },
                                        { label: '성별', value: profile.gender },
                                    ].map(row => (
                                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                            <span style={{ width: 90, fontSize: 13, color: '#888', flexShrink: 0,  }}>{row.label}</span>
                                            <span style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 500,  }}>{row.value}</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <span style={{ width: 90, fontSize: 13, color: '#888', flexShrink: 0,  }}>색각 유형</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 500,  }}>{COLOR_TYPE_LABELS[profile.colorType] || '미설정'}</span>
                                            <button onClick={() => { setShowColorTest(true); setTestActive(true); setTestResult(null); }} style={btnPrimary}>
                                                {profile.colorType ? '재검사' : '테스트 시작'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0' }}>
                                        <span style={{ width: 90, fontSize: 13, color: '#888', flexShrink: 0,  }}>선호 스타일</span>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {(profile.styles || []).map(s => (
                                                <span key={s} style={{ padding: '4px 12px', background: 'rgba(113,179,229,0.12)', borderRadius: 999, fontSize: 12, color: '#71b3e5',  fontWeight: 500 }}>{STYLE_LABELS[s] || s}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {showColorTest && (
                                        <div style={{ marginTop: 20, background: 'rgba(113,179,229,0.05)', borderRadius: 16, padding: 20, border: '1px solid rgba(113,179,229,0.2)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <p style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: 0 }}>색각 유형 판별 테스트</p>
                                                <button onClick={() => { setShowColorTest(false); setTestActive(false); setTestResult(null); }} style={{ background: 'none', border: 'none', fontSize: 16, color: '#999', cursor: 'pointer' }}>✕</button>
                                            </div>
                                            <p style={{  fontSize: 12, color: '#888', marginBottom: 16 }}>의료 진단이 아닌 보조적 목적의 간이 테스트입니다. (총 8문항)</p>
                                            {testActive && !testResult && <ColorTest onResult={(r) => { setTestResult(r); setTestActive(false); }} />}
                                            {testResult && (
                                                <div style={{ background: 'white', borderRadius: 12, padding: 20, textAlign: 'center', marginTop: 16 }}>
                                                    <p style={{  fontSize: 13, color: '#71b3e5', margin: '0 0 8px' }}>테스트 결과</p>
                                                    <p style={{  fontWeight: 700, fontSize: 20, color: '#1a1a2e', margin: '0 0 8px' }}>{COLOR_TYPE_LABELS[testResult]}</p>
                                                    <p style={{  fontSize: 13, color: '#888', margin: '0 0 16px' }}>{COLOR_TYPE_DESCS[testResult]}</p>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button onClick={() => handleSaveColorType(testResult)} style={{ ...btnPrimary, flex: 1 }}>이 결과로 저장</button>
                                                        <button onClick={() => { setTestResult(null); setTestActive(true); }} style={{ flex: 1, padding: '8px 18px', background: '#f5f7fa', color: '#888', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer' }}>다시 테스트</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6,  }}>닉네임</label>
                                    <input style={inputStyle} value={editForm.nickname} onChange={e => setEditForm({ ...editForm, nickname: e.target.value })} maxLength={20} />
                                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6,  }}>연령대</label>
                                    <select style={inputStyle} value={editForm.ageGroup} onChange={e => setEditForm({ ...editForm, ageGroup: e.target.value })}>
                                        {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6,  }}>성별</label>
                                    <select style={inputStyle} value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                        <option value="여성">여성</option>
                                        <option value="남성">남성</option>
                                    </select>
                                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6,  }}>선호 스타일 (최대 3개)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        {STYLES.map(s => (
                                            <button key={s} type="button" onClick={() => toggleStyle(s)} style={{
                                                padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13,  fontWeight: 500,
                                                background: editForm.styles.includes(s) ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f5f7fa',
                                                color: editForm.styles.includes(s) ? 'white' : '#555',
                                            }}>
                                                {STYLE_LABELS[s]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 의류 순환 리포트 tab */}
                    {tab === '의류 순환 리포트' && (() => {
                        const now = new Date();
                        const thisMonthRecs = history.filter(r => {
                            const d = new Date(r.createdAt);
                            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                        });
                        const acceptedRecs = history.filter(r => r.acceptedOutfitIndex !== undefined && r.acceptedOutfitIndex !== null);

                        // TPO 집계
                        const tpoCounts: Record<string, number> = {};
                        history.forEach(r => { tpoCounts[r.tpo] = (tpoCounts[r.tpo] || 0) + 1; });
                        const sortedTpo = Object.entries(tpoCounts).sort((a, b) => b[1] - a[1]);
                        const maxTpo = sortedTpo.length > 0 ? sortedTpo[0][1] : 1;

                        // 스타일 집계
                        const styleCounts: Record<string, number> = {};
                        history.forEach(r => {
                            if (r.outfitInfos) Object.values(r.outfitInfos).forEach(info => {
                                if (info.style) styleCounts[info.style] = (styleCounts[info.style] || 0) + 1;
                            });
                        });
                        const sortedStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

                        // 옷장 카테고리 집계
                        const catMap: Record<string, string> = { '상의': '#4CAF8A', '하의': '#4A90D9', '아우터': '#E8832A', '원피스': '#E91E8C', '기타': '#95A5A6' };
                        const catCounts: Record<string, number> = {};
                        wardrobeItems.forEach(item => {
                            const raw = item.category || '기타';
                            let cat = '기타';
                            if (['상의', '탑', '티셔츠', '셔츠', '니트', '블라우스', '후드', '맨투맨'].some(k => raw.includes(k))) cat = '상의';
                            else if (['하의', '팬츠', '바지', '스커트', '반바지'].some(k => raw.includes(k))) cat = '하의';
                            else if (['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건'].some(k => raw.includes(k))) cat = '아우터';
                            else if (['원피스', '드레스'].some(k => raw.includes(k))) cat = '원피스';
                            catCounts[cat] = (catCounts[cat] || 0) + 1;
                        });
                        const totalWardrobe = wardrobeItems.length || 1;

                        return (
                            <div>
                                {/* 요약 stat boxes */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                                    {[
                                        { label: '전체 추천', value: history.length, unit: '회', color: '#71b3e5' },
                                        { label: '이번 달', value: thisMonthRecs.length, unit: '회', color: '#7EC8A4' },
                                        { label: '수락한 코디', value: acceptedRecs.length, unit: '개', color: '#FF6B9D' },
                                        { label: '옷장 아이템', value: wardrobeItems.length, unit: '개', color: '#F5A623' },
                                    ].map(({ label, value, unit, color }) => (
                                        <div key={label} style={{ background: 'white', borderRadius: 16, padding: '18px 16px', border: '1px solid #eaedf2', textAlign: 'center' }}>
                                            <p style={{  fontWeight: 800, fontSize: 26, color, margin: 0, lineHeight: 1 }}>{value}<span style={{ fontSize: 13, fontWeight: 500, color: '#aaa', marginLeft: 2 }}>{unit}</span></p>
                                            <p style={{  fontWeight: 400, fontSize: 12, color: '#888', margin: '8px 0 0' }}>{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* TPO 활용 현황 */}
                                <div style={{ ...cardStyle, marginBottom: 16 }}>
                                    <h3 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 18px' }}>TPO 활용 현황</h3>
                                    {sortedTpo.length === 0 ? (
                                        <p style={{  fontSize: 13, color: '#bbb', textAlign: 'center', padding: '20px 0' }}>아직 추천 기록이 없어요</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {sortedTpo.map(([tpo, count]) => {
                                                const color = TPO_COLORS[tpo] || '#71b3e5';
                                                const pct = Math.round((count / maxTpo) * 100);
                                                return (
                                                    <div key={tpo}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                            <span style={{  fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{tpo}</span>
                                                            <span style={{  fontWeight: 700, fontSize: 13, color }}>{count}회</span>
                                                        </div>
                                                        <div style={{ height: 8, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
                                    {/* 자주 추천된 스타일 */}
                                    <div style={cardStyle}>
                                        <h3 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 14px' }}>자주 추천된 스타일</h3>
                                        {sortedStyles.length === 0 ? (
                                            <p style={{  fontSize: 13, color: '#bbb', padding: '12px 0' }}>데이터가 없어요</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {sortedStyles.map(([style, count], i) => (
                                                    <div key={style} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: i === 0 ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : '#f5f7fa', border: i === 0 ? 'none' : '1px solid #eaedf2' }}>
                                                        <span style={{  fontWeight: 600, fontSize: 12, color: i === 0 ? 'white' : '#555' }}>{style}</span>
                                                        <span style={{  fontWeight: 700, fontSize: 11, color: i === 0 ? 'rgba(255,255,255,0.8)' : '#aaa' }}>{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 옷장 카테고리 구성 */}
                                    <div style={cardStyle}>
                                        <h3 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 14px' }}>옷장 카테고리 구성</h3>
                                        {wardrobeItems.length === 0 ? (
                                            <p style={{  fontSize: 13, color: '#bbb', padding: '12px 0' }}>옷장에 아이템이 없어요</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => {
                                                    const color = catMap[cat] || '#95A5A6';
                                                    const pct = Math.round((cnt / totalWardrobe) * 100);
                                                    return (
                                                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                            <span style={{  fontSize: 12, color: '#555', width: 44, flexShrink: 0 }}>{cat}</span>
                                                            <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                                                            </div>
                                                            <span style={{  fontWeight: 700, fontSize: 11, color: '#aaa', width: 30, textAlign: 'right', flexShrink: 0 }}>{cnt}개</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 최근 코디 타임라인 */}
                                {history.length > 0 && (
                                    <div style={{ ...cardStyle, marginTop: 16 }}>
                                        <h3 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 16px' }}>최근 추천 타임라인</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                            {history.slice(0, 6).map((rec, i) => {
                                                const color = TPO_COLORS[rec.tpo] || '#71b3e5';
                                                const d = new Date(rec.createdAt);
                                                const label = `${d.getMonth() + 1}/${d.getDate()}`;
                                                const accepted = rec.acceptedOutfitIndex !== undefined && rec.acceptedOutfitIndex !== null;
                                                const style = rec.outfitInfos?.[rec.acceptedOutfitIndex ?? 0]?.style;
                                                return (
                                                    <div key={rec.recId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < Math.min(history.length, 6) - 1 ? 14 : 0 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginTop: 4 }} />
                                                            {i < Math.min(history.length, 6) - 1 && <div style={{ width: 2, height: '100%', minHeight: 28, background: '#eaedf2', marginTop: 4 }} />}
                                                        </div>
                                                        <div style={{ flex: 1, paddingBottom: i < Math.min(history.length, 6) - 1 ? 6 : 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                <span style={{  fontSize: 11, color: '#aaa' }}>{label}</span>
                                                                <span style={{  fontWeight: 700, fontSize: 11, color, background: color + '18', padding: '2px 8px', borderRadius: 20 }}>{rec.tpo}</span>
                                                                {style && <span style={{  fontSize: 11, color: '#555' }}>{style}</span>}
                                                                {accepted && <span style={{  fontSize: 10, color: '#71b3e5', background: 'rgba(113,179,229,0.1)', padding: '1px 7px', borderRadius: 20 }}>수락</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* 색상 어시스턴트 tab */}
                    {tab === '색상 어시스턴트' && (
                        <div>
                            <div style={cardStyle}>
                                <h3 style={{  fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: '0 0 16px' }}>색상 어시스턴트</h3>
                                <div style={{ background: 'rgba(113,179,229,0.07)', border: '1px solid rgba(113,179,229,0.2)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                                    <p style={{  fontWeight: 600, fontSize: 12, color: '#71b3e5', margin: '0 0 6px' }}>내 색각 유형</p>
                                    <p style={{  fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: 0 }}>{COLOR_TYPE_LABELS[profile.colorType] || '미설정'}</p>
                                    {!profile.colorType && <p style={{ fontSize: 12, color: '#aaa', margin: '4px 0 0',  }}>프로필 탭에서 색각 유형 테스트를 진행해주세요</p>}
                                </div>

                                <h4 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 8px' }}>내 스타일 색상 조합 추천</h4>
                                <p style={{  fontSize: 13, color: '#888', margin: '0 0 16px' }}>선호 스타일을 기반으로 어울리는 색상 조합을 추천드려요</p>
                                {(profile.styles || []).length === 0 ? (
                                    <p style={{  fontSize: 14, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>프로필에서 선호 스타일을 설정해주세요.</p>
                                ) : (
                                    (profile.styles || []).map(styleKey => {
                                        const palette = STYLE_COLOR_PALETTES[styleKey];
                                        if (!palette) return null;
                                        return (
                                            <div key={styleKey} style={{ marginBottom: 20 }}>
                                                <p style={{  fontWeight: 600, fontSize: 13, color: '#888', margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #eaedf2' }}>{STYLE_LABELS[styleKey]} 스타일 추천 색상</p>
                                                {palette.palettes.map((p, pi) => (
                                                    <div key={pi} style={{ background: '#f8f9fc', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #eaedf2' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <p style={{  fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{p.name}</p>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                {p.colors.map((c, ci) => (
                                                                    <div key={ci} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: ['#ffffff', '#f5f5f5'].includes(c) ? '1px solid #e0e0e0' : 'none' }} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p style={{  fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })
                                )}

                                {profile.colorType && profile.colorType !== 'normal' && COLOR_TYPE_WARN[profile.colorType] && (
                                    <div style={{ marginTop: 24 }}>
                                        <h4 style={{  fontWeight: 700, fontSize: 15, color: '#e74c3c', margin: '0 0 8px' }}>⚠️ {COLOR_TYPE_WARN[profile.colorType]!.label}</h4>
                                        <p style={{  fontSize: 13, color: '#888', margin: '0 0 16px' }}>색각 유형에 따라 아래 색상 조합은 코디 시 주의해주세요.</p>
                                        {COLOR_TYPE_WARN[profile.colorType]!.items.map((item, wi) => (
                                            <div key={wi} style={{ background: '#FFF5F5', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #FECACA' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <p style={{  fontWeight: 600, fontSize: 14, color: '#1a1a2e', margin: 0 }}>{item.name}</p>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {item.colors.map((c, ci) => <div key={ci} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.1)' }} />)}
                                                    </div>
                                                </div>
                                                <p style={{  fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {profile.colorType && profile.colorType !== 'normal' && (
                                <div style={cardStyle}>
                                    <h4 style={{  fontWeight: 700, fontSize: 15, color: '#1a1a2e', margin: '0 0 8px' }}>색약 보정 뷰어</h4>
                                    <p style={{  fontSize: 13, color: '#888', margin: '0 0 16px' }}>의류 이미지를 업로드하면 색각 이상 시뮬레이션과 보정 결과를 비교할 수 있습니다.</p>
                                    <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>이미지 업로드</button>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                                    {daltonizing && <p style={{  color: '#888', fontSize: 14, textAlign: 'center', marginTop: 12 }}>보정 처리 중...</p>}
                                    {daltonizeResult && (
                                        <>
                                            <button onClick={() => fileInputRef.current?.click()} style={{ ...btnSecondary, marginTop: 12, marginLeft: 8 }}>다른 사진 보정하기</button>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                                                {[
                                                    { label: '원본', src: daltonizeResult.original },
                                                    { label: '색각 이상 시뮬레이션', src: daltonizeResult.simulated },
                                                    { label: '보정 후', src: daltonizeResult.corrected },
                                                ].map(item => (
                                                    <div key={item.label} style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                                                        <p style={{  fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 8 }}>{item.label}</p>
                                                        <img src={item.src} alt={item.label} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12 }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MyPage;
