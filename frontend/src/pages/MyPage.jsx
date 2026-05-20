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
    'tritanopia': '제3색맹 (청색맹)'
};
const COLOR_TYPE_DESCS = {
    'normal': '색각이 정상입니다.',
    'protanopia': '빨간색 계열 구분이 어렵습니다.',
    'deuteranopia': '초록색 계열 구분이 어렵습니다.',
    'tritanopia': '파란색 계열 구분이 어렵습니다.'
};

// 스타일별 안전 색상 조합 추천
const STYLE_COLOR_PALETTES = {
    business: {
        label: '비즈니스',
        palettes: [
            { name: '클래식 네이비', colors: ['#1a2a5e', '#ffffff', '#c0c0c0'], desc: '남색 + 흰색 + 실버 — 신뢰감 있는 정장 코디' },
            { name: '차콜 그레이', colors: ['#36454f', '#f5f5f5', '#8b7355'], desc: '차콜 + 아이보리 + 베이지 — 모던한 오피스 룩' },
            { name: '블랙 포멀', colors: ['#1a1a1a', '#ffffff', '#c9a84c'], desc: '블랙 + 화이트 + 골드 — 격식 있는 미팅룩' },
        ]
    },
    formal: {
        label: '포멀',
        palettes: [
            { name: '모노크롬', colors: ['#1a1a1a', '#888888', '#f0f0f0'], desc: '블랙 + 그레이 + 화이트 — 세련된 포멀 코디' },
            { name: '네이비 클래식', colors: ['#1a2a5e', '#c9a84c', '#ffffff'], desc: '네이비 + 골드 + 화이트 — 품격 있는 스타일' },
        ]
    },
    casual: {
        label: '캐주얼',
        palettes: [
            { name: '어스톤', colors: ['#8B6914', '#D2B48C', '#F5DEB3'], desc: '브라운 + 베이지 + 크림 — 자연스러운 캐주얼' },
            { name: '데님 믹스', colors: ['#1560BD', '#f5f5f5', '#c0392b'], desc: '블루 + 화이트 + 레드 포인트 — 활기찬 캐주얼' },
            { name: '그린 어스', colors: ['#355E3B', '#D2B48C', '#F5DEB3'], desc: '카키 + 베이지 + 크림 — 내추럴 스타일' },
        ]
    },
    lovely: {
        label: '러블리',
        palettes: [
            { name: '핑크 로맨틱', colors: ['#FFB6C1', '#ffffff', '#C8A2C8'], desc: '라이트핑크 + 화이트 + 라일락 — 사랑스러운 코디' },
            { name: '파스텔 믹스', colors: ['#FADADD', '#B0E0E6', '#FFFACD'], desc: '파스텔 핑크 + 파우더 블루 + 레몬 — 상큼한 여성스타일' },
        ]
    },
    feminine: {
        label: '페미닌',
        palettes: [
            { name: '로즈 & 누드', colors: ['#C9707A', '#F5CBA7', '#ffffff'], desc: '로즈 + 누드 + 화이트 — 우아한 페미닌 룩' },
            { name: '버건디 클래식', colors: ['#800020', '#f5f5f5', '#D4AF37'], desc: '버건디 + 아이보리 + 골드 — 고급스러운 여성미' },
        ]
    },
    sporty: {
        label: '스포티',
        palettes: [
            { name: '모노 스포티', colors: ['#1a1a1a', '#ffffff', '#FF4500'], desc: '블랙 + 화이트 + 오렌지 레드 — 역동적인 스포츠룩' },
            { name: '네온 믹스', colors: ['#1a1a1a', '#39FF14', '#ffffff'], desc: '블랙 + 네온그린 + 화이트 — 개성 있는 스트릿 스포티' },
        ]
    },
    comfort: {
        label: '컴포트',
        palettes: [
            { name: '뉴트럴 컴포트', colors: ['#D3D3D3', '#F5F5DC', '#A9A9A9'], desc: '라이트그레이 + 베이지 + 그레이 — 편안한 데일리 룩' },
            { name: '웜 베이지', colors: ['#F5DEB3', '#D2B48C', '#8B7355'], desc: '크림 + 베이지 + 탄 — 따뜻하고 편안한 스타일' },
        ]
    }
};

const TEST_QUESTIONS = [
    {
        question: "아래 원 안에서 숫자를 읽어주세요.",
        canvas: { bg: '#E8A87C', dots: '#6B4C3B', number: '6', hint: '정상이면 6이 보입니다' },
        options: ['6', '8', '잘 모르겠음'],
        normal: '6', protanopia: '8', deuteranopia: '8', tritanopia: '6'
    },
    {
        question: "아래 원 안에서 숫자를 읽어주세요.",
        canvas: { bg: '#7CB87C', dots: '#B87C7C', number: '3', hint: '정상이면 3이 보입니다' },
        options: ['3', '5', '잘 모르겠음'],
        normal: '3', protanopia: '5', deuteranopia: '5', tritanopia: '3'
    },
    {
        question: "아래 원 안에서 숫자를 읽어주세요.",
        canvas: { bg: '#7C7CB8', dots: '#B8B87C', number: '7', hint: '정상이면 7이 보입니다' },
        options: ['7', '잘 모르겠음', '1'],
        normal: '7', protanopia: '7', deuteranopia: '7', tritanopia: '잘 모르겠음'
    },
    {
        question: "두 색상 중 더 다르게 보이는 쌍을 선택하세요.",
        options: ['빨강과 초록', '파랑과 노랑', '차이가 없음'],
        normal: '빨강과 초록', protanopia: '차이가 없음',
        deuteranopia: '차이가 없음', tritanopia: '빨강과 초록'
    }
];

function analyzeTestResult(answers) {
    let scores = { normal: 0, protanopia: 0, deuteranopia: 0, tritanopia: 0 };
    answers.forEach((answer, i) => {
        const q = TEST_QUESTIONS[i];
        Object.keys(scores).forEach(type => {
            if (q[type] === answer) scores[type]++;
        });
    });
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function ColorTest({ step, onAnswer }) {
    const q = TEST_QUESTIONS[step - 1];
    return (
        <div style={colorStyles.testBox}>
            <p style={colorStyles.testStep}>{step} / 4</p>
            <p style={colorStyles.testQuestion}>{q.question}</p>
            {q.canvas && (
                <div style={{
                    width: '160px', height: '160px', borderRadius: '50%',
                    backgroundColor: q.canvas.bg, margin: '16px auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '56px', fontWeight: 'bold', color: q.canvas.dots,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    {q.canvas.number}
                </div>
            )}
            {q.canvas?.hint && (
                <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>
                    {q.canvas.hint}
                </p>
            )}
            {q.options.map(opt => (
                <button key={opt} style={colorStyles.optionBtn} onClick={() => onAnswer(opt)}>
                    {opt}
                </button>
            ))}
        </div>
    );
}

function MyPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [tab, setTab] = useState('프로필');
    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            localStorage.clear();
            navigate('/login');
        }
    };


    // 색각 테스트 (프로필 탭 내)
    const [showColorTest, setShowColorTest] = useState(false);
    const [testStep, setTestStep] = useState(0);
    const [testAnswers, setTestAnswers] = useState([]);
    const [testResult, setTestResult] = useState(null);

    // 색상 어시스턴트 탭
    const [daltonizeResult, setDaltonizeResult] = useState(null);
    const [daltonizing, setDaltonizing] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchHistory();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await userAPI.getProfile();
            setProfile(res.data);
            setEditForm({
                nickname: res.data.nickname,
                ageGroup: res.data.ageGroup,
                gender: res.data.gender,
                colorType: res.data.colorType,
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

    const handleTestAnswer = (answer) => {
        const newAnswers = [...testAnswers, answer];
        setTestAnswers(newAnswers);
        if (testStep === 4) {
            const result = analyzeTestResult(newAnswers);
            setTestResult(result);
            setTestStep(5);
        } else {
            setTestStep(testStep + 1);
        }
    };

    const handleSaveColorType = async (colorType) => {
        try {
            await colorAssistantAPI.updateColorType(colorType);
            await fetchProfile();
            setShowColorTest(false);
            setTestStep(0);
            setTestAnswers([]);
            setTestResult(null);
            alert(`색각 유형이 '${COLOR_TYPE_LABELS[colorType]}'으로 저장됐습니다.`);
        } catch (err) { alert('저장 실패'); }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
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

    const formatDate = (datetime) => {
        if (!datetime) return '';
        const d = new Date(datetime);
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!profile) return (
        <div style={styles.page}>
            <Navbar />
            <p style={{ textAlign: 'center', marginTop: '60px', color: '#888' }}>불러오는 중...</p>
        </div>
    );

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 프로필 헤더 */}
                <div style={styles.profileHeader}>
                    <div style={styles.avatar}>
                        {profile.nickname?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={styles.nicknameLarge}>{profile.nickname}</h1>
                        <p style={styles.loginIdText}>@{profile.loginId}</p>
                        <p style={styles.joinDate}>{formatDate(profile.createdAt)} 가입</p>
                    </div>
                    <button style={styles.logoutBtn} onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>

                {/* 탭 */}
                <div style={styles.tabRow}>
                    {TABS.map(t => (
                        <button key={t} style={{
                            ...styles.tabBtn,
                            borderBottom: tab === t ? '2px solid #333' : '2px solid transparent',
                            color: tab === t ? '#333' : '#888',
                            fontWeight: tab === t ? '600' : '400'
                        }} onClick={() => setTab(t)}>{t}</button>
                    ))}
                </div>

                {/* ── 프로필 탭 ── */}
                {tab === '프로필' && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>내 프로필</h2>
                            {!editMode ? (
                                <button style={styles.editBtn} onClick={() => setEditMode(true)}>수정</button>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
                                        {loading ? '저장 중...' : '저장'}
                                    </button>
                                    <button style={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                                </div>
                            )}
                        </div>

                        {!editMode ? (
                            <div style={styles.profileInfo}>
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>닉네임</span>
                                    <span style={styles.infoValue}>{profile.nickname}</span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>아이디</span>
                                    <span style={styles.infoValue}>{profile.loginId}</span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>연령대</span>
                                    <span style={styles.infoValue}>{profile.ageGroup}</span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>성별</span>
                                    <span style={styles.infoValue}>{profile.gender}</span>
                                </div>

                                {/* 색각 유형 + 테스트 버튼 */}
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>색각 유형</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={styles.infoValue}>
                                            {COLOR_TYPE_LABELS[profile.colorType] || '미설정'}
                                        </span>
                                        <button style={colorStyles.testTriggerBtn}
                                                onClick={() => { setShowColorTest(true); setTestStep(1); setTestAnswers([]); setTestResult(null); }}>
                                            {profile.colorType ? '재검사' : '테스트 시작'}
                                        </button>
                                    </div>
                                </div>

                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>선호 스타일</span>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {(profile.styles || []).map(s => (
                                            <span key={s} style={styles.styleChip}>{STYLE_LABELS[s] || s}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* 색각 유형 판별 테스트 인라인 */}
                                {showColorTest && (
                                    <div style={colorStyles.inlineTestBox}>
                                        <div style={colorStyles.inlineTestHeader}>
                                            <p style={colorStyles.inlineTestTitle}>색각 유형 판별 테스트</p>
                                            <button style={colorStyles.closeTestBtn}
                                                    onClick={() => { setShowColorTest(false); setTestStep(0); }}>✕</button>
                                        </div>
                                        <p style={colorStyles.inlineTestDesc}>
                                            의료 진단이 아닌 보조적 목적의 간이 테스트입니다.
                                        </p>

                                        {testStep >= 1 && testStep <= 4 && (
                                            <ColorTest step={testStep} onAnswer={handleTestAnswer} />
                                        )}

                                        {testStep === 5 && testResult && (
                                            <div style={colorStyles.resultBox}>
                                                <p style={colorStyles.resultTitle}>테스트 결과</p>
                                                <p style={colorStyles.resultValue}>
                                                    {COLOR_TYPE_LABELS[testResult]}
                                                </p>
                                                <p style={colorStyles.resultDesc}>
                                                    {COLOR_TYPE_DESCS[testResult]}
                                                </p>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                    <button style={colorStyles.saveColorBtn}
                                                            onClick={() => handleSaveColorType(testResult)}>
                                                        이 결과로 저장
                                                    </button>
                                                    <button style={colorStyles.retryBtn}
                                                            onClick={() => { setTestStep(1); setTestAnswers([]); setTestResult(null); }}>
                                                        다시 테스트
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={styles.editForm}>
                                <label style={styles.editLabel}>닉네임</label>
                                <input style={styles.editInput} value={editForm.nickname}
                                       onChange={e => setEditForm({ ...editForm, nickname: e.target.value })} maxLength={20} />
                                <label style={styles.editLabel}>연령대</label>
                                <select style={styles.editInput} value={editForm.ageGroup}
                                        onChange={e => setEditForm({ ...editForm, ageGroup: e.target.value })}>
                                    {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <label style={styles.editLabel}>성별</label>
                                <select style={styles.editInput} value={editForm.gender}
                                        onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                    <option value="여성">여성</option>
                                    <option value="남성">남성</option>
                                </select>
                                <label style={styles.editLabel}>선호 스타일 (최대 3개)</label>
                                <div style={styles.styleGrid}>
                                    {STYLES.map(s => (
                                        <button key={s} type="button"
                                                style={{
                                                    ...styles.styleToggle,
                                                    backgroundColor: editForm.styles.includes(s) ? '#333' : '#f0f0f0',
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
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>추천 이력</h2>
                        {history.length === 0 ? (
                            <p style={styles.emptyText}>추천 이력이 없습니다.</p>
                        ) : (
                            history.map((rec, i) => (
                                <div key={rec.recId || i} style={styles.historyCard}>
                                    <div style={styles.historyTop}>
                                        <span style={styles.historyTpo}>{rec.tpo}</span>
                                        <span style={styles.historyDate}>{formatDate(rec.createdAt)}</span>
                                    </div>
                                    {rec.style && <span style={styles.historyStyle}>{rec.style}</span>}
                                    {rec.temperature && (
                                        <p style={styles.historyWeather}>{rec.temperature}°C · {rec.weatherCondition}</p>
                                    )}
                                    {rec.description && <p style={styles.historyDesc}>{rec.description}</p>}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── 색상 어시스턴트 탭 ── */}
                {tab === '색상 어시스턴트' && (
                    <div>
                        {/* 색각 유형 현황 */}
                        <div style={styles.section}>
                            <h2 style={styles.sectionTitle}>색상 어시스턴트</h2>
                            <div style={colorStyles.typeBox}>
                                <p style={colorStyles.typeLabel}>내 색각 유형</p>
                                <p style={colorStyles.typeValue}>
                                    {COLOR_TYPE_LABELS[profile.colorType] || '미설정'}
                                </p>
                                {!profile.colorType && (
                                    <p style={{ fontSize: '12px', color: '#aaa', margin: '4px 0 0' }}>
                                        프로필 탭에서 색각 유형 테스트를 진행해주세요
                                    </p>
                                )}
                            </div>

                            {/* 색상 조합 추천 */}
                            <h3 style={colorStyles.subTitle}>내 스타일 색상 조합 추천</h3>
                            <p style={colorStyles.desc}>
                                선호 스타일을 기반으로 어울리는 색상 조합을 추천드려요
                            </p>

                            {(profile.styles || []).length === 0 ? (
                                <p style={styles.emptyText}>프로필에서 선호 스타일을 설정해주세요.</p>
                            ) : (
                                (profile.styles || []).map(styleKey => {
                                    const palette = STYLE_COLOR_PALETTES[styleKey];
                                    if (!palette) return null;
                                    return (
                                        <div key={styleKey} style={colorStyles.paletteSection}>
                                            <p style={colorStyles.paletteSectionTitle}>
                                                {STYLE_LABELS[styleKey]} 스타일 추천 색상
                                            </p>
                                            {palette.palettes.map((p, pi) => (
                                                <div key={pi} style={colorStyles.paletteCard}>
                                                    <div style={colorStyles.paletteTop}>
                                                        <p style={colorStyles.paletteName}>{p.name}</p>
                                                        <div style={colorStyles.colorDots}>
                                                            {p.colors.map((c, ci) => (
                                                                <div key={ci} style={{
                                                                    ...colorStyles.colorDot,
                                                                    backgroundColor: c,
                                                                    border: c === '#ffffff' || c === '#f5f5f5' || c === '#F5F5DC' || c === '#FFFACD' || c === '#F5DEB3'
                                                                        ? '1px solid #e0e0e0' : 'none'
                                                                }} title={c} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p style={colorStyles.paletteDesc}>{p.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* 색약 보정 뷰어 */}
                        {profile.colorType && profile.colorType !== 'normal' && (
                            <div style={{ ...styles.section, marginTop: '16px' }}>
                                <h3 style={colorStyles.subTitle}>색약 보정 뷰어</h3>
                                <p style={colorStyles.desc}>
                                    의류 이미지를 업로드하면 색각 이상 시뮬레이션과 보정 결과를 비교할 수 있습니다.
                                </p>
                                <button style={colorStyles.uploadBtn}
                                        onClick={() => fileInputRef.current.click()}>
                                    이미지 업로드
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*"
                                       style={{ display: 'none' }} onChange={handleImageUpload} />

                                {daltonizing && <p style={colorStyles.loadingText}>보정 처리 중...</p>}

                                {daltonizeResult && (
                                    <div style={colorStyles.compareBox}>
                                        <div style={colorStyles.compareItem}>
                                            <p style={colorStyles.compareLabel}>원본</p>
                                            <img src={daltonizeResult.original} alt="원본" style={colorStyles.compareImg} />
                                        </div>
                                        <div style={colorStyles.compareItem}>
                                            <p style={colorStyles.compareLabel}>색각 이상 시뮬레이션</p>
                                            <img src={daltonizeResult.simulated} alt="시뮬레이션" style={colorStyles.compareImg} />
                                        </div>
                                        <div style={colorStyles.compareItem}>
                                            <p style={colorStyles.compareLabel}>보정 후</p>
                                            <img src={daltonizeResult.corrected} alt="보정" style={colorStyles.compareImg} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
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
    sectionTitle: { fontSize: '17px', fontWeight: '700', color: theme.colors.text, margin: 0 },
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
    logoutBtn: {
        padding: '8px 16px',
        backgroundColor: 'white',
        color: theme.colors.danger,
        border: `1px solid ${theme.colors.danger}`,
        borderRadius: theme.radius.full,
        fontSize: '13px',
        cursor: 'pointer',
        fontWeight: '500',
        alignSelf: 'flex-start',
    },
    profileInfo: {},
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
    editForm: {},
    editLabel: { fontSize: '12px', color: theme.colors.textSub, display: 'block', marginBottom: '6px', marginTop: '14px' },
    editInput: {
        width: '100%', padding: '10px 12px', borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`, fontSize: '14px', boxSizing: 'border-box'
    },
    styleGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    styleToggle: { padding: '8px 14px', borderRadius: theme.radius.full, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    emptyText: { color: theme.colors.textLight, fontSize: '14px', textAlign: 'center', padding: '32px 0' },
    historyCard: {
        backgroundColor: theme.colors.background, borderRadius: theme.radius.lg,
        padding: '14px', marginBottom: '10px'
    },
    historyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    historyTpo: {
        fontSize: '13px', fontWeight: '600', color: theme.colors.primary,
        backgroundColor: theme.colors.primaryLight, padding: '4px 12px', borderRadius: theme.radius.full
    },
    historyDate: { fontSize: '12px', color: theme.colors.textLight },
    historyStyle: {
        fontSize: '12px', color: theme.colors.textSub, backgroundColor: theme.colors.white,
        padding: '2px 10px', borderRadius: theme.radius.full, display: 'inline-block', marginBottom: '6px'
    },
    historyWeather: { fontSize: '13px', color: theme.colors.textSub, margin: '4px 0' },
    historyDesc: { fontSize: '13px', color: theme.colors.text, lineHeight: '1.6', margin: '6px 0 0' },
};

const colorStyles = {
    testTriggerBtn: {
        padding: '4px 12px', backgroundColor: theme.colors.primary, color: 'white',
        border: 'none', borderRadius: theme.radius.full, fontSize: '12px', cursor: 'pointer', fontWeight: '500'
    },
    inlineTestBox: {
        marginTop: '16px', backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.lg,
        padding: '20px', border: `1px solid ${theme.colors.primary}44`
    },
    inlineTestHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    inlineTestTitle: { fontSize: '15px', fontWeight: '700', color: theme.colors.primary, margin: 0 },
    inlineTestDesc: { fontSize: '12px', color: theme.colors.textSub, marginBottom: '16px' },
    closeTestBtn: { background: 'none', border: 'none', fontSize: '16px', color: '#999', cursor: 'pointer' },
    testBox: { textAlign: 'center' },
    testStep: { fontSize: '12px', color: theme.colors.textLight, marginBottom: '8px' },
    testQuestion: { fontSize: '15px', color: theme.colors.text, marginBottom: '12px' },
    optionBtn: {
        display: 'block', width: '100%', padding: '12px', margin: '8px 0',
        backgroundColor: theme.colors.white, color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md,
        fontSize: '14px', cursor: 'pointer'
    },
    resultBox: {
        backgroundColor: theme.colors.background, borderRadius: theme.radius.lg,
        padding: '20px', textAlign: 'center'
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
    compareImg: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: theme.radius.md }
};

export default MyPage;