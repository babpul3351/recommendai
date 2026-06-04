import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { userAPI, recommendationAPI, colorAssistantAPI } from '../api/api';
import { theme } from '../styles/theme';

const STYLES = ['casual', 'formal', 'business', 'lovely', 'feminine', 'sporty', 'comfort'];
const STYLE_LABELS = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트'
};
const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대이상'];
const TABS = ['프로필', '추천 이력', '색상 어시스턴트'];

const COLOR_TYPE_LABELS = {
    'normal': '정상 색각',
    'protanopia': '제1색맹 (적색맹)',
    'deuteranopia': '제2색맹 (녹색맹)',
    'tritanopia': '제3색맹 (청황색맹)'
};
const COLOR_TYPE_DESCS = {
    'normal': '색각이 정상입니다.',
    'protanopia': '빨간색 계열 구분이 어렵습니다.',
    'deuteranopia': '초록색 계열 구분이 어렵습니다.',
    'tritanopia': '파란/노란색 계열 구분이 어렵습니다.'
};

const WEEKDAYS_KR = ['일','월','화','수','목','금','토'];
const formatOutfitDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}월 ${d}일 (${WEEKDAYS_KR[dt.getDay()]})`;
};

// ── 색각 유형별 주의 색상 조합 (색각유형_허서윤.html 기반) ──
const COLOR_TYPE_WARN = {
    protanopia: {
        label: '적색맹 주의 색상 조합',
        items: [
            { colors: ['#8b0000', '#1a1a1a'], name: '다크레드 + 블랙', desc: '빨간색이 어둡게 보여서 검정과 거의 같아 보일 수 있어요.' },
            { colors: ['#cc3333', '#2d8c3c'], name: '빨강 + 초록', desc: '빨강이 탁하게 느껴져서 초록과 헷갈리기 쉬운 조합이에요.' },
            { colors: ['#8b1a2a', '#556b2f'], name: '와인 + 카키', desc: '두 색 모두 어둡고 탁해서 상하의 구분이 잘 안 될 수 있어요.' },
        ]
    },
    deuteranopia: {
        label: '녹색맹 주의 색상 조합',
        items: [
            { colors: ['#cc3333', '#2d8c3c'], name: '빨강 + 초록', desc: '이 두 색이 비슷한 색으로 보여서 코디 포인트가 사라질 수 있어요.' },
            { colors: ['#8B4513', '#228B22'], name: '갈색 + 짙은 초록', desc: '어둡고 탁한 색끼리라 입었을 때 경계가 흐릿하게 보일 수 있어요.' },
            { colors: ['#6f7448', '#d8c8a2'], name: '카키 + 베이지', desc: '카키가 갈색처럼 보여서 베이지와 구분이 어려울 수 있어요.' },
        ]
    },
    tritanopia: {
        label: '청황색맹 주의 색상 조합',
        items: [
            { colors: ['#1a66cc', '#f0c040'], name: '블루 + 옐로우', desc: '두 색이 비슷한 밝기로 느껴져 구분이 어려울 수 있어요.' },
            { colors: ['#2563eb', '#7c3aed'], name: '파랑 + 보라', desc: '파란 계열끼리라 하나로 뭉쳐 보일 수 있어요.' },
            { colors: ['#0f9992', '#98e2d2'], name: '청록 + 민트', desc: '비슷한 느낌의 색이라 경계가 흐릿해 보일 수 있어요.' },
        ]
    },
    normal: null,
};

// ── 스타일별 추천 색상 조합 ──
const STYLE_COLOR_PALETTES = {
    business: { label: '비즈니스', palettes: [
            { name: '클래식 네이비', colors: ['#1a2a5e', '#ffffff', '#c0c0c0'], desc: '남색 + 흰색 + 실버 — 신뢰감 있는 정장 코디' },
            { name: '차콜 그레이', colors: ['#36454f', '#f5f5f5', '#8b7355'], desc: '차콜 + 아이보리 + 베이지 — 모던한 오피스 룩' },
            { name: '블랙 포멀', colors: ['#1a1a1a', '#ffffff', '#c9a84c'], desc: '블랙 + 화이트 + 골드 — 격식 있는 미팅룩' },
        ]},
    formal: { label: '포멀', palettes: [
            { name: '모노크롬', colors: ['#1a1a1a', '#888888', '#f0f0f0'], desc: '블랙 + 그레이 + 화이트 — 세련된 포멀 코디' },
            { name: '네이비 클래식', colors: ['#1a2a5e', '#c9a84c', '#ffffff'], desc: '네이비 + 골드 + 화이트 — 품격 있는 스타일' },
        ]},
    casual: { label: '캐주얼', palettes: [
            { name: '어스톤', colors: ['#8B6914', '#D2B48C', '#F5DEB3'], desc: '브라운 + 베이지 + 크림 — 자연스러운 캐주얼' },
            { name: '데님 믹스', colors: ['#1560BD', '#f5f5f5', '#c0392b'], desc: '블루 + 화이트 + 레드 포인트 — 활기찬 캐주얼' },
            { name: '그린 어스', colors: ['#355E3B', '#D2B48C', '#F5DEB3'], desc: '카키 + 베이지 + 크림 — 내추럴 스타일' },
        ]},
    lovely: { label: '러블리', palettes: [
            { name: '핑크 로맨틱', colors: ['#FFB6C1', '#ffffff', '#C8A2C8'], desc: '라이트핑크 + 화이트 + 라일락 — 사랑스러운 코디' },
            { name: '파스텔 믹스', colors: ['#FADADD', '#B0E0E6', '#FFFACD'], desc: '파스텔 핑크 + 파우더 블루 + 레몬 — 상큼한 스타일' },
        ]},
    feminine: { label: '페미닌', palettes: [
            { name: '로즈 & 누드', colors: ['#C9707A', '#F5CBA7', '#ffffff'], desc: '로즈 + 누드 + 화이트 — 우아한 페미닌 룩' },
            { name: '버건디 클래식', colors: ['#800020', '#f5f5f5', '#D4AF37'], desc: '버건디 + 아이보리 + 골드 — 고급스러운 여성미' },
        ]},
    sporty: { label: '스포티', palettes: [
            { name: '모노 스포티', colors: ['#1a1a1a', '#ffffff', '#FF4500'], desc: '블랙 + 화이트 + 오렌지 레드 — 역동적인 스포츠룩' },
            { name: '네온 믹스', colors: ['#1a1a1a', '#39FF14', '#ffffff'], desc: '블랙 + 네온그린 + 화이트 — 개성 있는 스트릿 스포티' },
        ]},
    comfort: { label: '컴포트', palettes: [
            { name: '뉴트럴 컴포트', colors: ['#D3D3D3', '#F5F5DC', '#A9A9A9'], desc: '라이트그레이 + 베이지 + 그레이 — 편안한 데일리 룩' },
            { name: '웜 베이지', colors: ['#F5DEB3', '#D2B48C', '#8B7355'], desc: '크림 + 베이지 + 탄 — 따뜻하고 편안한 스타일' },
        ]},
};

// ════════════════════════════════════════
// 통합 색각 테스트 컴포넌트
// (index.html 숫자 문항 5개 + 색각유형_허서윤.html 알파벳/영단어 문항 3개)
// ════════════════════════════════════════
function ColorTest({ onResult }) {
    const canvasRef = useRef(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [rendered, setRendered] = useState(false);

    // 8문항: 숫자 5 + 알파벳/영단어 3
    const PLATES = [
        {
            id: 1, text: '29',
            question: '원 안의 숫자를 읽어주세요',
            category: '적록 판별',
            options: ['29', '70', '21', '보기 어려움'],
            answer: '29', weight: 'deutan',
            bg: ['#9eaa68','#b0b977','#8f9b5e','#c0bd80'],
            fg: ['#bd694d','#ca7a5a','#a95743','#d18a69'],
        },
        {
            id: 2, text: '45',
            question: '원 안의 숫자를 읽어주세요',
            category: '적색 판별',
            options: ['45', '15', '48', '보기 어려움'],
            answer: '45', weight: 'protan',
            bg: ['#c67a68','#b9685c','#d08d75','#b75f51'],
            fg: ['#728f5b','#668453','#83a168','#5a744a'],
        },
        {
            id: 3, text: '7',
            question: '원 안의 숫자를 읽어주세요',
            category: '청황 판별',
            options: ['7', '1', '3', '보기 어려움'],
            answer: '7', weight: 'tritan',
            bg: ['#c4b45f','#d1c36f','#b9a753','#d8ca83'],
            fg: ['#536fab','#46619b','#657fba','#3d558a'],
        },
        {
            id: 4, text: '12',
            question: '원 안의 숫자를 읽어주세요',
            category: '기준 확인',
            options: ['12', '17', '21', '보기 어려움'],
            answer: '12', weight: 'normal',
            bg: ['#d4bd72','#c7a961','#e0ca87','#b99b58'],
            fg: ['#405c86','#324b73','#536f98','#253d61'],
        },
        {
            id: 5, text: '5',
            question: '원 안의 숫자를 읽어주세요',
            category: '적색 판별',
            options: ['5', '6', '8', '보기 어려움'],
            answer: '5', weight: 'protan',
            bg: ['#cf9077','#c57d6d','#d9a08a','#b96c60'],
            fg: ['#6f8d69','#5e7c5e','#82a17a','#537052'],
        },
        {
            id: 6, text: 'RED', isWord: true,
            question: '원 안에 숨겨진 영단어를 찾아주세요',
            category: '적록 판별',
            options: ['RED', 'BED', 'REB', '보기 어려움'],
            answer: 'RED', weight: 'deutan',
            bg: ['#c8d090','#b8c070','#d8e0a0','#e0e8b0','#a8b860'],
            fg: ['#d06040','#c04828','#e07050','#b83820'],
        },
        {
            id: 7, text: 'GO', isWord: true,
            question: '원 안에 숨겨진 영단어를 찾아주세요',
            category: '녹색 판별',
            options: ['GO', 'DO', '보이지 않음', '보기 어려움'],
            answer: 'GO', weight: 'protan',
            bg: ['#a8c8a8','#98b898','#b8d8b8','#88a888','#c0d8c0'],
            fg: ['#c04040','#d05050','#b03030','#c84848'],
        },
        {
            id: 8, text: 'B', isWord: true,
            question: '원 안에 숨겨진 알파벳을 찾아주세요',
            category: '청황 판별',
            options: ['B', 'E', 'R', '보기 어려움'],
            answer: 'B', weight: 'tritan',
            bg: ['#a0c8e0','#80b0d0','#c0d8f0','#b0c8e8','#90b8d8'],
            fg: ['#e08020','#d06010','#f09030','#c07008'],
        },
    ];

    // ── index.html의 정확한 drawPlate 방식 ──
    function createTextMask(W, text, isWord) {
        const mc = document.createElement('canvas');
        mc.width = W; mc.height = W;
        const mctx = mc.getContext('2d');
        mctx.clearRect(0, 0, W, W);
        mctx.fillStyle = '#000';
        mctx.textAlign = 'center';
        mctx.textBaseline = 'middle';
        // 글자 크기: 한 글자는 크게, 여러 글자는 작게
        const fontSize = isWord
            ? (text.length === 1 ? Math.round(W * 0.62) : Math.round(W * 0.34))
            : (text.length > 1 ? Math.round(W * 0.40) : Math.round(W * 0.52));
        mctx.font = `900 ${fontSize}px Arial, sans-serif`;
        mctx.fillText(text, W / 2, W / 2 + fontSize * 0.04);
        return mctx;
    }

    function isTextPixel(maskCtx, x, y) {
        try {
            return maskCtx.getImageData(
                Math.max(0, Math.min(Math.floor(x), maskCtx.canvas.width - 1)),
                Math.max(0, Math.min(Math.floor(y), maskCtx.canvas.height - 1)),
                1, 1
            ).data[3] > 16;
        } catch (e) { return false; }
    }

    function randColor(colors) {
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function drawDot(ctx, x, y, r, colors) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = randColor(colors);
        ctx.fill();
    }

    function randomInCircle(cx, cy, radius) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * radius;
        return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
    }

    function drawPlate(canvas, plate) {
        const W = canvas.width;
        const cx = W / 2, cy = W / 2;
        const radius = W * 0.45;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, W, W);
        ctx.fillStyle = '#f7fafc';
        ctx.fillRect(0, 0, W, W);

        const mask = createTextMask(W, plate.text, plate.isWord || false);

        // 1. 배경 점 (1450개)
        for (let i = 0; i < 1450; i++) {
            const p = randomInCircle(cx, cy, radius);
            drawDot(ctx, p.x, p.y, 5 + Math.random() * 9, plate.bg);
        }

        // 2. 글자 점 (최대 620개, 글자 영역에만)
        let drawn = 0, attempts = 0;
        while (drawn < 620 && attempts < 620 * 18) {
            attempts++;
            const p = randomInCircle(cx, cy, radius * 0.82);
            if (!isTextPixel(mask, p.x, p.y)) continue;
            drawDot(ctx, p.x, p.y, 7 + Math.random() * 10, plate.fg);
            drawn++;
        }

        // 3. 작은 질감 점 (260개)
        for (let i = 0; i < 260; i++) {
            const p = randomInCircle(cx, cy, radius);
            const colors = isTextPixel(mask, p.x, p.y) ? plate.fg : plate.bg;
            drawDot(ctx, p.x, p.y, 3 + Math.random() * 5, colors);
        }

        // 4. 원형 테두리
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#d7dee6';
        ctx.stroke();

        setRendered(true);
    }

    // step 변경 시 Canvas 렌더링
    useEffect(() => {
        if (!canvasRef.current) return;
        setRendered(false);
        // requestAnimationFrame으로 Canvas가 DOM에 완전히 마운트된 후 그림
        const raf = requestAnimationFrame(() => {
            if (canvasRef.current) {
                drawPlate(canvasRef.current, PLATES[step]);
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [step]);

    const analyze = (ans) => {
        const miss = { protan: 0, deutan: 0, tritan: 0 };
        ans.forEach((a, i) => {
            const p = PLATES[i];
            if (a !== p.answer && miss[p.weight] !== undefined) miss[p.weight]++;
        });
        // 정답률이 높으면 정상
        const total = ans.filter((a, i) => a === PLATES[i].answer).length;
        if (total >= PLATES.length - 1) { onResult('normal'); return; }
        // 가장 많이 틀린 유형
        const dominant = Object.entries(miss).sort((a, b) => b[1] - a[1])[0];
        if (dominant[1] === 0) { onResult('normal'); return; }
        if (dominant[0] === 'protan') { onResult('protanopia'); return; }
        if (dominant[0] === 'deutan') { onResult('deuteranopia'); return; }
        if (dominant[0] === 'tritan') { onResult('tritanopia'); return; }
        onResult('normal');
    };

    const handleAnswer = (opt) => {
        const newAns = [...answers, opt];
        setAnswers(newAns);
        if (step + 1 >= PLATES.length) {
            analyze(newAns);
        } else {
            setRendered(false);
            setStep(step + 1);
        }
    };

    const plate = PLATES[step];
    const progress = Math.round(((step + 1) / PLATES.length) * 100);

    return (
        <div style={{ textAlign: 'center' }}>
            {/* 진행 바 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                    flex: 1, height: '5px', backgroundColor: theme.colors.border,
                    borderRadius: '4px', overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${progress}%`, height: '100%',
                        backgroundColor: theme.colors.primary, borderRadius: '4px',
                        transition: 'width 0.35s ease',
                    }} />
                </div>
                <span style={{ fontSize: '12px', color: theme.colors.textSub, whiteSpace: 'nowrap' }}>
                    {step + 1} / {PLATES.length}
                </span>
            </div>

            {/* 카테고리 태그 */}
            <div style={{
                display: 'inline-block', padding: '3px 12px',
                backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
                borderRadius: '20px', fontSize: '11px', fontWeight: '700', marginBottom: '12px'
            }}>
                {plate.category}
            </div>

            {/* 질문 */}
            <p style={{ fontSize: '15px', fontWeight: '600', color: theme.colors.dark, marginBottom: '18px' }}>
                {plate.question}
            </p>

            {/* Canvas */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                {!rendered && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: '#f7fafc', borderRadius: '50%', zIndex: 1,
                    }}>
                        <span style={{ fontSize: '12px', color: theme.colors.textSub }}>로딩 중...</span>
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={400}
                    style={{
                        width: '220px',
                        height: '220px',
                        borderRadius: '50%',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                        display: 'block',
                        imageRendering: 'auto',
                    }}
                />
            </div>

            {/* 선택지 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {plate.options.map(opt => (
                    <button key={opt} onClick={() => handleAnswer(opt)} style={{
                        width: '100%', padding: '13px 18px',
                        border: `1.5px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.md, backgroundColor: theme.colors.white,
                        fontSize: '15px', fontWeight: '500', color: theme.colors.dark,
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        fontFamily: 'inherit', transition: 'border-color 0.15s',
                    }}>
                        <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            border: `2px solid ${theme.colors.border}`, flexShrink: 0
                        }} />
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ════════════════════════════════════════
// MyPage 메인
// ════════════════════════════════════════
const TPO_COLOR = {
    '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
    '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2',
    '일상': '#9B9B9B', '격식': '#4A4A4A',
};

const CAT_COLOR = {
    '상의': '#4CAF8A', '하의': '#4A90D9',
    '아우터': '#E8832A', '원피스': '#E91E8C',
};

function MyPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [tab, setTab] = useState('프로필');
    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    // 색각 테스트 상태
    const [showColorTest, setShowColorTest] = useState(false);
    const [testActive, setTestActive] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // 색약 보정 뷰어
    const [daltonizeResult, setDaltonizeResult] = useState(null);
    const [daltonizing, setDaltonizing] = useState(false);

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            localStorage.clear();
            navigate('/login');
        }
    };

    useEffect(() => { fetchProfile(); fetchHistory(); }, []);

    const fetchProfile = async () => {
        try {
            const res = await userAPI.getProfile();
            setProfile(res.data);
            setEditForm({
                nickname: res.data.nickname, ageGroup: res.data.ageGroup,
                gender: res.data.gender, colorType: res.data.colorType,
                styles: res.data.styles || []
            });
        } catch (err) { console.error(err); }
    };

    const fetchHistory = async () => {
        try {
            const res = await recommendationAPI.getHistory();
            setHistory(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await userAPI.updateProfile(editForm);
            localStorage.setItem('nickname', editForm.nickname);
            await fetchProfile();
            setEditMode(false);
            alert('프로필이 수정됐습니다.');
        } catch (err) { alert('수정 실패'); }
        finally { setLoading(false); }
    };

    const toggleStyle = (style) => {
        if (editForm.styles.includes(style)) {
            setEditForm({ ...editForm, styles: editForm.styles.filter(s => s !== style) });
        } else if (editForm.styles.length < 3) {
            setEditForm({ ...editForm, styles: [...editForm.styles, style] });
        }
    };

    const handleSaveColorType = async (colorType) => {
        try {
            await colorAssistantAPI.updateColorType(colorType);
            await fetchProfile();
            setShowColorTest(false);
            setTestActive(false);
            setTestResult(null);
            alert(`'${COLOR_TYPE_LABELS[colorType]}'으로 저장됐습니다.`);
        } catch (err) { alert('저장 실패'); }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        e.target.value = '';        // ← 즉시 초기화 (같은 파일 재선택 가능하게)
        setDaltonizeResult(null);   // ← 이전 결과 초기화

        const reader = new FileReader();
        reader.onloadend = async () => {
            setDaltonizing(true);
            try {
                const res = await colorAssistantAPI.daltonize(reader.result, profile.colorType);
                setDaltonizeResult(res.data);
            } catch (err) { alert('보정 처리에 실패했습니다.'); }
            finally { setDaltonizing(false); }
        };
        reader.readAsDataURL(file);
    };

    const handleChangeAccept = async (recId, outfitIndex, info) => {
        try {
            await recommendationAPI.acceptOutfit(recId, {
                outfitIndex,
                style:       info?.style       || '',
                description: info?.description || '',
            });
            await fetchHistory(); // 이력 즉시 갱신
        } catch {
            alert('변경에 실패했습니다.');
        }
    };

    const formatDate = (datetime) => {
        if (!datetime) return '';
        return new Date(datetime).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!profile) return (
        <div style={S.page}><Navbar />
            <p style={{ textAlign: 'center', marginTop: '60px', color: '#888' }}>불러오는 중...</p>
        </div>
    );

    return (
        <div style={S.page}>
            <Navbar />
            <div style={S.container}>

                {/* 프로필 헤더 */}
                <div style={S.profileHeader}>
                    <div style={S.avatar}>{profile.nickname?.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                        <h1 style={S.nicknameLarge}>{profile.nickname}</h1>
                        <p style={S.loginIdText}>@{profile.loginId}</p>
                        <p style={S.joinDate}>{formatDate(profile.createdAt)} 가입</p>
                    </div>
                    <button style={S.logoutBtn} onClick={handleLogout}>로그아웃</button>
                </div>

                {/* 탭 */}
                <div style={S.tabRow}>
                    {TABS.map(t => (
                        <button key={t} style={{
                            ...S.tabBtn,
                            borderBottom: tab === t ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                            color: tab === t ? theme.colors.primary : '#888',
                            fontWeight: tab === t ? '700' : '400'
                        }} onClick={() => setTab(t)}>{t}</button>
                    ))}
                </div>

                {/* ── 프로필 탭 ── */}
                {tab === '프로필' && (
                    <div style={S.section}>
                        <div style={S.sectionHeader}>
                            <h2 style={S.sectionTitle}>내 프로필</h2>
                            {!editMode ? (
                                <button style={S.editBtn} onClick={() => setEditMode(true)}>수정</button>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={S.saveBtn} onClick={handleSave} disabled={loading}>
                                        {loading ? '저장 중...' : '저장'}
                                    </button>
                                    <button style={S.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
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
                                    <div key={row.label} style={S.infoRow}>
                                        <span style={S.infoLabel}>{row.label}</span>
                                        <span style={S.infoValue}>{row.value}</span>
                                    </div>
                                ))}

                                {/* 색각 유형 + 테스트 */}
                                <div style={S.infoRow}>
                                    <span style={S.infoLabel}>색각 유형</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={S.infoValue}>
                                            {COLOR_TYPE_LABELS[profile.colorType] || '미설정'}
                                        </span>
                                        <button style={CS.testTriggerBtn} onClick={() => {
                                            setShowColorTest(true);
                                            setTestActive(true);
                                            setTestResult(null);
                                        }}>
                                            {profile.colorType ? '재검사' : '테스트 시작'}
                                        </button>
                                    </div>
                                </div>

                                {/* 선호 스타일 */}
                                <div style={S.infoRow}>
                                    <span style={S.infoLabel}>선호 스타일</span>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {(profile.styles || []).map(s => (
                                            <span key={s} style={S.styleChip}>{STYLE_LABELS[s] || s}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* 인라인 테스트 */}
                                {showColorTest && (
                                    <div style={CS.inlineTestBox}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <p style={CS.inlineTestTitle}>색각 유형 판별 테스트</p>
                                            <button style={CS.closeTestBtn} onClick={() => {
                                                setShowColorTest(false);
                                                setTestActive(false);
                                                setTestResult(null);
                                            }}>✕</button>
                                        </div>
                                        <p style={CS.inlineTestDesc}>
                                            의료 진단이 아닌 보조적 목적의 간이 테스트입니다. (총 8문항)
                                        </p>

                                        {testActive && !testResult && (
                                            <ColorTest onResult={(r) => {
                                                setTestResult(r);
                                                setTestActive(false);
                                            }} />
                                        )}

                                        {testResult && (
                                            <div style={CS.resultBox}>
                                                <p style={CS.resultTitle}>테스트 결과</p>
                                                <p style={CS.resultValue}>{COLOR_TYPE_LABELS[testResult]}</p>
                                                <p style={CS.resultDesc}>{COLOR_TYPE_DESCS[testResult]}</p>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                    <button style={CS.saveColorBtn}
                                                            onClick={() => handleSaveColorType(testResult)}>
                                                        이 결과로 저장
                                                    </button>
                                                    <button style={CS.retryBtn} onClick={() => {
                                                        setTestResult(null);
                                                        setTestActive(true);
                                                    }}>
                                                        다시 테스트
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* 편집 폼 */
                            <div>
                                <label style={S.editLabel}>닉네임</label>
                                <input style={S.editInput} value={editForm.nickname}
                                       onChange={e => setEditForm({ ...editForm, nickname: e.target.value })} maxLength={20} />
                                <label style={S.editLabel}>연령대</label>
                                <select style={S.editInput} value={editForm.ageGroup}
                                        onChange={e => setEditForm({ ...editForm, ageGroup: e.target.value })}>
                                    {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <label style={S.editLabel}>성별</label>
                                <select style={S.editInput} value={editForm.gender}
                                        onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                    <option value="여성">여성</option>
                                    <option value="남성">남성</option>
                                </select>
                                <label style={S.editLabel}>선호 스타일 (최대 3개)</label>
                                <div style={S.styleGrid}>
                                    {STYLES.map(s => (
                                        <button key={s} type="button"
                                                style={{
                                                    ...S.styleToggle,
                                                    backgroundColor: editForm.styles.includes(s) ? theme.colors.primary : '#f0f0f0',
                                                    color: editForm.styles.includes(s) ? 'white' : '#333'
                                                }}
                                                onClick={() => toggleStyle(s)}>
                                            {STYLE_LABELS[s]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 추천 이력 탭 ── */}
                {tab === '추천 이력' && (
                    <div style={S.section}>
                        <h2 style={S.sectionTitle}>추천 이력</h2>
                        {history.length === 0 ? (
                            <p style={S.emptyText}>추천 이력이 없습니다.</p>
                        ) : (
                            history.map((rec, i) => (
                                <div key={rec.recId || i} style={S.histCard}>

                                    {/* ── 컬러 헤더 ── */}
                                    <div style={{
                                        ...S.histHeader,
                                        background: `linear-gradient(135deg,
                ${TPO_COLOR[rec.tpo] || theme.colors.primary}DD,
                ${TPO_COLOR[rec.tpo] || theme.colors.primary}99)`,
                                    }}>
                                        <div style={S.histHeaderTop}>
                                            <span style={S.histTpoPill}>{rec.tpo}</span>
                                            {rec.retryCount > 0 && (
                                                <span style={S.histRetryPill}>🔄 재추천 {rec.retryCount}회</span>
                                            )}
                                            <span style={S.histCreatedAt}>{formatDate(rec.createdAt)}</span>
                                        </div>
                                        <div style={S.histHeaderBottom}>
                                            {rec.outfitDate ? (
                                                <span style={S.histDateBig}>
                        📅 {formatOutfitDate(rec.outfitDate)} 코디
                    </span>
                                            ) : (
                                                <span style={S.histDateBig}>코디 추천</span>
                                            )}
                                            {rec.temperature && (
                                                <span style={S.histWeatherPill}>
                        🌡 {rec.temperature}°C · {rec.weatherCondition}
                    </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── 본문 ── */}
                                    <div style={S.histBody}>

                                        {rec.description && (
                                            <p style={S.histGlobalDesc}>"{rec.description}"</p>
                                        )}

                                        {rec.allOutfitGroups && Object.keys(rec.allOutfitGroups).length > 0 ? (
                                            Object.entries(rec.allOutfitGroups).map(([idxStr, items]) => {
                                                const idx        = parseInt(idxStr);
                                                const isAccepted = rec.acceptedOutfitIndex === idx;
                                                const info       = rec.outfitInfos?.[idx];

                                                return (
                                                    <div key={idx} style={{
                                                        ...S.histOutfitBlock,
                                                        background:  isAccepted ? theme.colors.primaryLight : '#F7F9FB',
                                                        borderLeft:  isAccepted
                                                            ? `3px solid ${theme.colors.primary}`
                                                            : '3px solid #E0E6ED',
                                                    }}>
                                                        {/* 코디 블록 헤더 */}
                                                        <div style={S.histBlockHead}>
                                                            <div style={S.histBlockHeadLeft}>
                                    <span style={{
                                        ...S.histOutfitNum,
                                        background: isAccepted
                                            ? theme.colors.primary : '#B0BEC5',
                                    }}>{idx + 1}</span>
                                                                {info?.style && (
                                                                    <span style={{
                                                                        ...S.histStyleTag,
                                                                        color: isAccepted
                                                                            ? theme.colors.primary : '#607D8B',
                                                                        background: isAccepted ? 'white' : '#EEF2F5',
                                                                        border: isAccepted
                                                                            ? `1px solid ${theme.colors.primary}44`
                                                                            : '1px solid #DDE3E9',
                                                                    }}>{info.style}</span>
                                                                )}
                                                            </div>
                                                            {isAccepted && (
                                                                <span style={S.histAcceptedBadge}>✓ 선택됨</span>
                                                            )}
                                                        </div>

                                                        {/* 아이템 사진 스트립 */}
                                                        {items.length > 0 ? (
                                                            <div style={S.histStrip}>
                                                                {items.map((item, ii) => (
                                                                    <div key={ii} style={S.histStripItem}>
                                                                        {item.imageUrl ? (
                                                                            <img src={item.imageUrl}
                                                                                 alt={item.type}
                                                                                 style={S.histStripImg}/>
                                                                        ) : (
                                                                            <div style={S.histStripImgEmpty}>👗</div>
                                                                        )}
                                                                        <span style={{
                                                                            ...S.histCatLabel,
                                                                            background: CAT_COLOR[item.category]
                                                                                || theme.colors.primary,
                                                                        }}>{item.category}</span>
                                                                        <p style={S.histItemType}>{item.type}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p style={S.histNoItem}>매칭 아이템 없음</p>
                                                        )}

                                                        {/* 변경 버튼 */}
                                                        {!isAccepted && (
                                                            <button
                                                                style={S.histChangeCta}
                                                                onClick={() => handleChangeAccept(rec.recId, idx, info)}
                                                            >
                                                                이 코디로 변경하기
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p style={S.histEmpty}>코디 정보 없음</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── 색상 어시스턴트 탭 ── */}
                {tab === '색상 어시스턴트' && (
                    <div>
                        <div style={S.section}>
                            <h2 style={S.sectionTitle}>색상 어시스턴트</h2>

                            {/* 현재 색각 유형 */}
                            <div style={CS.typeBox}>
                                <p style={CS.typeLabel}>내 색각 유형</p>
                                <p style={CS.typeValue}>
                                    {COLOR_TYPE_LABELS[profile.colorType] || '미설정'}
                                </p>
                                {!profile.colorType && (
                                    <p style={{ fontSize: '12px', color: '#aaa', margin: '4px 0 0' }}>
                                        프로필 탭에서 색각 유형 테스트를 진행해주세요
                                    </p>
                                )}
                            </div>

                            {/* 내 스타일 색상 조합 추천 */}
                            <h3 style={CS.subTitle}>내 스타일 색상 조합 추천</h3>
                            <p style={CS.desc}>선호 스타일을 기반으로 어울리는 색상 조합을 추천드려요</p>
                            {(profile.styles || []).length === 0 ? (
                                <p style={S.emptyText}>프로필에서 선호 스타일을 설정해주세요.</p>
                            ) : (
                                (profile.styles || []).map(styleKey => {
                                    const palette = STYLE_COLOR_PALETTES[styleKey];
                                    if (!palette) return null;
                                    return (
                                        <div key={styleKey} style={CS.paletteSection}>
                                            <p style={CS.paletteSectionTitle}>
                                                {STYLE_LABELS[styleKey]} 스타일 추천 색상
                                            </p>
                                            {palette.palettes.map((p, pi) => (
                                                <div key={pi} style={CS.paletteCard}>
                                                    <div style={CS.paletteTop}>
                                                        <p style={CS.paletteName}>{p.name}</p>
                                                        <div style={CS.colorDots}>
                                                            {p.colors.map((c, ci) => (
                                                                <div key={ci} style={{
                                                                    ...CS.colorDot, backgroundColor: c,
                                                                    border: ['#ffffff','#f5f5f5','#F5DEB3','#FFFACD'].includes(c)
                                                                        ? '1px solid #e0e0e0' : 'none'
                                                                }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p style={CS.paletteDesc}>{p.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            )}

                            {/* 색각 유형별 주의 색상 조합 */}
                            {profile.colorType && profile.colorType !== 'normal' && COLOR_TYPE_WARN[profile.colorType] && (
                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ ...CS.subTitle, color: '#E74C3C' }}>
                                        ⚠️ {COLOR_TYPE_WARN[profile.colorType].label}
                                    </h3>
                                    <p style={CS.desc}>
                                        색각 유형에 따라 아래 색상 조합은 코디 시 주의해주세요.
                                    </p>
                                    {COLOR_TYPE_WARN[profile.colorType].items.map((item, wi) => (
                                        <div key={wi} style={{ ...CS.paletteCard, backgroundColor: '#FFF5F5', borderColor: '#FECACA' }}>
                                            <div style={CS.paletteTop}>
                                                <p style={CS.paletteName}>{item.name}</p>
                                                <div style={CS.colorDots}>
                                                    {item.colors.map((c, ci) => (
                                                        <div key={ci} style={{
                                                            ...CS.colorDot, backgroundColor: c,
                                                            border: '1px solid rgba(0,0,0,0.1)'
                                                        }} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p style={CS.paletteDesc}>{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 색약 보정 뷰어 */}
                        {profile.colorType && profile.colorType !== 'normal' && (
                            <div style={{ ...S.section, marginTop: '16px' }}>
                                <h3 style={CS.subTitle}>색약 보정 뷰어</h3>
                                <p style={CS.desc}>
                                    의류 이미지를 업로드하면 색각 이상 시뮬레이션과 보정 결과를 비교할 수 있습니다.
                                </p>
                                <button style={CS.uploadBtn} onClick={() => fileInputRef.current.click()}>
                                    이미지 업로드
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*"
                                       style={{ display: 'none' }} onChange={handleImageUpload} />
                                {daltonizing && <p style={CS.loadingText}>보정 처리 중...</p>}

                                {daltonizeResult && (
                                    <>
                                        {/* 다른 사진 보정하기 버튼 추가 */}
                                        <button
                                            style={{
                                                ...CS.uploadBtn,
                                                backgroundColor: theme.colors.white,
                                                color: theme.colors.primary,
                                                border: `1px solid ${theme.colors.primary}`,
                                                marginBottom: '12px',
                                                marginLeft: '6px'
                                            }}
                                            onClick={() => fileInputRef.current.click()}
                                        >
                                            다른 사진 보정하기
                                        </button>

                                        <div style={CS.compareBox}>
                                            {[
                                                { label: '원본', src: daltonizeResult.original },
                                                { label: '색각 이상 시뮬레이션', src: daltonizeResult.simulated },
                                                { label: '보정 후', src: daltonizeResult.corrected },
                                            ].map(item => (
                                                <div key={item.label} style={CS.compareItem}>
                                                    <p style={CS.compareLabel}>{item.label}</p>
                                                    <img src={item.src} alt={item.label} style={CS.compareImg} />
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
    );
}

const S = {
    page: { backgroundColor: theme.colors.background, minHeight: '100vh' },
    container: { maxWidth: '480px', margin: '0 auto', padding: '20px 20px 90px' },
    profileHeader: {
        display: 'flex', alignItems: 'center', gap: '16px',
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl, padding: '20px',
        marginBottom: '16px', boxShadow: theme.colors.cardShadow
    },
    avatar: {
        width: '64px', height: '64px', borderRadius: '50%',
        backgroundColor: theme.colors.primary, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '24px', fontWeight: '700', flexShrink: 0
    },
    nicknameLarge: { fontSize: '20px', fontWeight: '700', color: theme.colors.text, margin: '0 0 4px' },
    loginIdText: { fontSize: '13px', color: theme.colors.textSub, margin: '0 0 2px' },
    joinDate: { fontSize: '12px', color: theme.colors.textLight, margin: 0 },
    logoutBtn: {
        padding: '8px 16px', backgroundColor: 'white', color: theme.colors.danger,
        border: `1px solid ${theme.colors.danger}`, borderRadius: theme.radius.full,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500', alignSelf: 'flex-start',
    },
    tabRow: {
        display: 'flex', marginBottom: '16px', backgroundColor: theme.colors.white,
        borderRadius: theme.radius.xl, padding: '4px', boxShadow: theme.colors.cardShadow
    },
    tabBtn: {
        flex: 1, padding: '11px', background: 'none', border: 'none',
        fontSize: '13px', cursor: 'pointer', borderRadius: theme.radius.lg
    },
    section: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        padding: '20px', boxShadow: theme.colors.cardShadow
    },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    sectionTitle: { fontSize: '17px', fontWeight: '700', color: theme.colors.text, margin: '0 0 16px'},
    editBtn: {
        padding: '7px 16px', backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    saveBtn: {
        padding: '7px 16px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer', fontWeight: '600'
    },
    cancelBtn: {
        padding: '7px 16px', backgroundColor: theme.colors.background, color: theme.colors.textSub,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer'
    },
    infoRow: {
        display: 'flex', alignItems: 'center', padding: '12px 0',
        borderBottom: `1px solid ${theme.colors.border}`
    },
    infoLabel: { width: '90px', fontSize: '13px', color: theme.colors.textSub, flexShrink: 0 },
    infoValue: { fontSize: '14px', color: theme.colors.text, fontWeight: '500' },
    styleChip: {
        padding: '4px 12px', backgroundColor: theme.colors.primaryLight,
        borderRadius: theme.radius.full, fontSize: '12px', color: theme.colors.primary, fontWeight: '500'
    },
    editLabel: { fontSize: '12px', color: theme.colors.textSub, display: 'block', marginBottom: '6px', marginTop: '14px' },
    editInput: {
        width: '100%', padding: '10px 12px', borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`, fontSize: '14px', boxSizing: 'border-box'
    },
    styleGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    styleToggle: { padding: '8px 14px', borderRadius: theme.radius.full, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    emptyText: { color: theme.colors.textLight, fontSize: '14px', textAlign: 'center', padding: '32px 0' },
    // ── 추천 이력 카드 ──────────────────────────────
    // 기존 histMeta → histInfoRow 로 교체
    // histOutfitLabel → histOutfitMeta 로 교체
    // 기존 histMeta → histInfoRow 로 교체
    // ── 추천 이력 카드 ─────────────────────────────
    histCard: {
        background: 'white',
        borderRadius: '20px',
        marginBottom: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.04)',
    },
// 컬러 헤더
    histHeader: {
        padding: '16px 18px 14px',
    },
    histHeaderTop: {
        display: 'flex', alignItems: 'center',
        gap: '7px', marginBottom: '10px', flexWrap: 'wrap',
    },
    histTpoPill: {
        fontSize: '12px', fontWeight: '800', color: 'white',
        background: 'rgba(255,255,255,0.25)',
        padding: '4px 12px', borderRadius: '20px',
    },
    histRetryPill: {
        fontSize: '10px', color: 'rgba(255,255,255,0.9)',
        background: 'rgba(255,255,255,0.18)',
        padding: '3px 9px', borderRadius: '20px',
    },
    histCreatedAt: {
        fontSize: '11px', color: 'rgba(255,255,255,0.7)',
        marginLeft: 'auto',
    },
    histHeaderBottom: {
        display: 'flex', alignItems: 'center',
        gap: '10px', flexWrap: 'wrap',
    },
    histDateBig: {
        fontSize: '17px', fontWeight: '800', color: 'white',
        letterSpacing: '-0.3px',
    },
    histWeatherPill: {
        fontSize: '11px', color: 'rgba(255,255,255,0.9)',
        background: 'rgba(255,255,255,0.18)',
        padding: '4px 10px', borderRadius: '20px',
    },
// 본문
    histBody: {
        padding: '14px 16px 16px',
    },
    histGlobalDesc: {
        fontSize: '12px', color: theme.colors.textSub,
        lineHeight: '1.65', margin: '0 0 12px',
        fontStyle: 'italic',
        paddingLeft: '10px',
        borderLeft: `2px solid ${theme.colors.primaryLight}`,
    },
// 코디 블록
    histOutfitBlock: {
        borderRadius: '14px', padding: '12px 14px',
        marginBottom: '10px', transition: 'all 0.15s',
    },
    histBlockHead: {
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '11px',
    },
    histBlockHeadLeft: {
        display: 'flex', alignItems: 'center', gap: '8px',
    },
    histOutfitNum: {
        width: '24px', height: '24px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '900', color: 'white', flexShrink: 0,
    },
    histStyleTag: {
        fontSize: '12px', fontWeight: '700',
        padding: '3px 10px', borderRadius: '20px',
    },
    histAcceptedBadge: {
        fontSize: '11px', fontWeight: '700',
        color: theme.colors.primary, background: 'white',
        padding: '4px 12px', borderRadius: '20px',
        border: `1.5px solid ${theme.colors.primary}`,
    },
// 사진 스트립
    histStrip: {
        display: 'flex', gap: '10px', flexWrap: 'wrap',
    },
    histStripItem: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '4px', width: '70px',
    },
    histStripImg: {
        width: '70px', height: '70px', objectFit: 'cover',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    },
    histStripImgEmpty: {
        width: '70px', height: '70px', borderRadius: '12px',
        background: theme.colors.primaryLight,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '24px',
    },
    histCatLabel: {
        fontSize: '9px', fontWeight: '700', color: 'white',
        padding: '2px 6px', borderRadius: '5px',
    },
    histItemType: {
        fontSize: '10px', color: theme.colors.text, fontWeight: '500',
        margin: 0, textAlign: 'center', maxWidth: '70px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    histNoItem: {
        fontSize: '11px', color: theme.colors.textLight,
        margin: 0, padding: '6px 0',
    },
// 변경 버튼
    histChangeCta: {
        marginTop: '12px', width: '100%', padding: '10px',
        background: 'white',
        border: `1.5px solid ${theme.colors.primary}`,
        borderRadius: '10px', fontSize: '13px', fontWeight: '700',
        color: theme.colors.primary, cursor: 'pointer',
        letterSpacing: '-0.2px',
    },
    histEmpty: {
        fontSize: '12px', color: theme.colors.textLight,
        textAlign: 'center', padding: '16px 0',
    },
// ─────────────────────────────────────────────
};

const CS = {
    testTriggerBtn: {
        padding: '4px 12px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '12px', cursor: 'pointer', fontWeight: '500'
    },
    inlineTestBox: {
        marginTop: '16px', backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.lg,
        padding: '20px', border: `1px solid ${theme.colors.primary}44`
    },
    inlineTestTitle: { fontSize: '15px', fontWeight: '700', color: theme.colors.primary, margin: 0 },
    inlineTestDesc: { fontSize: '12px', color: theme.colors.textSub, marginBottom: '16px' },
    closeTestBtn: { background: 'none', border: 'none', fontSize: '16px', color: '#999', cursor: 'pointer' },
    resultBox: {
        backgroundColor: theme.colors.background, borderRadius: theme.radius.lg,
        padding: '20px', textAlign: 'center', marginTop: '16px'
    },
    resultTitle: { fontSize: '13px', color: theme.colors.primary, margin: '0 0 8px' },
    resultValue: { fontSize: '20px', fontWeight: '700', color: theme.colors.text, margin: '0 0 8px' },
    resultDesc: { fontSize: '13px', color: theme.colors.textSub, margin: 0 },
    saveColorBtn: {
        flex: 1, padding: '10px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px', cursor: 'pointer', fontWeight: '600'
    },
    retryBtn: {
        flex: 1, padding: '10px', backgroundColor: theme.colors.background, color: theme.colors.textSub,
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px', cursor: 'pointer'
    },
    typeBox: {
        backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.lg,
        padding: '16px', marginBottom: '20px'
    },
    typeLabel: { fontSize: '12px', color: theme.colors.primary, margin: '0 0 6px', fontWeight: '600' },
    typeValue: { fontSize: '16px', fontWeight: '700', color: theme.colors.text, margin: 0 },
    subTitle: { fontSize: '16px', fontWeight: '700', color: theme.colors.text, marginBottom: '8px' },
    desc: { fontSize: '13px', color: theme.colors.textSub, marginBottom: '16px' },
    paletteSection: { marginBottom: '24px' },
    paletteSectionTitle: {
        fontSize: '14px', fontWeight: '600', color: theme.colors.textSub,
        margin: '0 0 12px', paddingBottom: '6px', borderBottom: `1px solid ${theme.colors.border}`
    },
    paletteCard: {
        backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
        padding: '14px', marginBottom: '10px', border: `1px solid ${theme.colors.border}`
    },
    paletteTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    paletteName: { fontSize: '14px', fontWeight: '600', color: theme.colors.text, margin: 0 },
    colorDots: { display: 'flex', gap: '6px' },
    colorDot: { width: '28px', height: '28px', borderRadius: '50%' },
    paletteDesc: { fontSize: '12px', color: theme.colors.textSub, margin: 0, lineHeight: '1.5' },
    uploadBtn: {
        padding: '10px 20px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '14px',
        cursor: 'pointer', marginBottom: '16px', fontWeight: '500'
    },
    loadingText: { color: theme.colors.textSub, fontSize: '14px', textAlign: 'center' },
    compareBox: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' },
    compareItem: { flex: 1, minWidth: '140px', textAlign: 'center' },
    compareLabel: { fontSize: '12px', color: theme.colors.textSub, fontWeight: '600', marginBottom: '8px' },
    compareImg: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: theme.radius.md },
    retryBadge: {
        fontSize: '11px', color: '#F57F17', backgroundColor: '#FFF8E1',
        padding: '2px 8px', borderRadius: theme.radius.full,
        fontWeight: '600', border: '1px solid #FFE082'
    },
    historyItems: {
        marginTop: '10px', paddingTop: '10px',
        borderTop: `1px solid ${theme.colors.border}`
    },
    historyItemsLabel: {
        fontSize: '11px', color: theme.colors.primary,
        fontWeight: '600', marginBottom: '8px', margin: '0 0 8px'
    },
    historyItemsGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    historyItem: { textAlign: 'center', width: '72px' },
    historyItemImg: {
        width: '72px', height: '72px', objectFit: 'cover',
        borderRadius: theme.radius.md
    },
    historyItemType: {
        fontSize: '11px', color: theme.colors.textSub,
        margin: '4px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
    },
    historyItemCat: {
        fontSize: '10px', color: theme.colors.primary,
        backgroundColor: theme.colors.primaryLight,
        padding: '1px 6px', borderRadius: theme.radius.full, display: 'inline-block'
    },
    historyNoSelect: {
        fontSize: '12px', color: theme.colors.textLight,
        marginTop: '8px', fontStyle: 'italic'
    },
    histOutfitGroup: {
        borderRadius: theme.radius.lg, padding: '12px',
        marginBottom: '10px', transition: 'all 0.2s',
    },
    histOutfitGroupHeader: {
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
    },
    histOutfitLabel: {
        fontSize: '12px', fontWeight: '700', color: 'white',
        backgroundColor: theme.colors.primary, padding: '2px 10px',
        borderRadius: theme.radius.full,
    },
    histOutfitStyle: {
        fontSize: '12px', color: theme.colors.textSub, fontWeight: '500',
    },
    histAcceptedBadge: {
        fontSize: '12px', fontWeight: '700', color: theme.colors.primary,
        marginLeft: 'auto',
    },
    histOutfitDateChip: {
        display: 'inline-block', fontSize: '12px', fontWeight: '700',
        color: theme.colors.primary, background: theme.colors.primaryLight,
        padding: '4px 10px', borderRadius: '8px',
    },
    histChangeBtn: {
        marginTop: '4px', padding: '3px 10px',
        background: 'none', border: `1px solid ${theme.colors.primary}`,
        borderRadius: '20px', fontSize: '10px', fontWeight: '700',
        color: theme.colors.primary, cursor: 'pointer',
    },
};

export default MyPage;