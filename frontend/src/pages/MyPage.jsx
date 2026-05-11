import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { userAPI, recommendationAPI } from '../api/api';

const STYLES = ['casual', 'formal', 'business', 'lovely', 'feminine', 'sporty', 'comfort'];
const STYLE_LABELS = {
    casual: '캐주얼', formal: '포멀', business: '비즈니스',
    lovely: '러블리', feminine: '페미닌', sporty: '스포티', comfort: '컴포트'
};
const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대이상'];
const COLOR_TYPES = [
    { key: null, label: '미설정' },
    { key: 'spring', label: '봄 웜톤' },
    { key: 'summer', label: '여름 쿨톤' },
    { key: 'autumn', label: '가을 웜톤' },
    { key: 'winter', label: '겨울 쿨톤' }
];

const TABS = ['프로필', '추천 이력', '색상 어시스턴트'];

function MyPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('프로필');
    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

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
        } catch (err) {
            alert('수정 실패');
        } finally {
            setLoading(false);
        }
    };

    const toggleStyle = (style) => {
        if (editForm.styles.includes(style)) {
            setEditForm({ ...editForm, styles: editForm.styles.filter(s => s !== style) });
        } else if (editForm.styles.length < 3) {
            setEditForm({ ...editForm, styles: [...editForm.styles, style] });
        }
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
                    <div>
                        <h1 style={styles.nicknameLarge}>{profile.nickname}</h1>
                        <p style={styles.loginIdText}>@{profile.loginId}</p>
                        <p style={styles.joinDate}>{formatDate(profile.createdAt)} 가입</p>
                    </div>
                </div>

                {/* 탭 */}
                <div style={styles.tabRow}>
                    {TABS.map(t => (
                        <button key={t}
                                style={{
                                    ...styles.tabBtn,
                                    borderBottom: tab === t ? '2px solid #333' : '2px solid transparent',
                                    color: tab === t ? '#333' : '#888',
                                    fontWeight: tab === t ? '600' : '400'
                                }}
                                onClick={() => setTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* 프로필 탭 */}
                {tab === '프로필' && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>내 프로필</h2>
                            {!editMode ? (
                                <button style={styles.editBtn} onClick={() => setEditMode(true)}>
                                    수정
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
                                        {loading ? '저장 중...' : '저장'}
                                    </button>
                                    <button style={styles.cancelBtn} onClick={() => setEditMode(false)}>
                                        취소
                                    </button>
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
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>색상 유형</span>
                                    <span style={styles.infoValue}>
                                        {COLOR_TYPES.find(c => c.key === profile.colorType)?.label || '미설정'}
                                    </span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>선호 스타일</span>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {(profile.styles || []).map(s => (
                                            <span key={s} style={styles.styleChip}>
                                                {STYLE_LABELS[s] || s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.editForm}>
                                <label style={styles.editLabel}>닉네임</label>
                                <input
                                    style={styles.editInput}
                                    value={editForm.nickname}
                                    onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
                                    maxLength={20}
                                />
                                <label style={styles.editLabel}>연령대</label>
                                <select
                                    style={styles.editInput}
                                    value={editForm.ageGroup}
                                    onChange={e => setEditForm({ ...editForm, ageGroup: e.target.value })}
                                >
                                    {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <label style={styles.editLabel}>성별</label>
                                <select
                                    style={styles.editInput}
                                    value={editForm.gender}
                                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                >
                                    <option value="여성">여성</option>
                                    <option value="남성">남성</option>
                                </select>
                                <label style={styles.editLabel}>색상 유형</label>
                                <select
                                    style={styles.editInput}
                                    value={editForm.colorType || ''}
                                    onChange={e => setEditForm({ ...editForm, colorType: e.target.value || null })}
                                >
                                    {COLOR_TYPES.map(c => (
                                        <option key={c.key || 'null'} value={c.key || ''}>
                                            {c.label}
                                        </option>
                                    ))}
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
                                                onClick={() => toggleStyle(s)}
                                        >
                                            {STYLE_LABELS[s]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 추천 이력 탭 */}
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
                                    {rec.style && (
                                        <span style={styles.historyStyle}>{rec.style}</span>
                                    )}
                                    {rec.temperature && (
                                        <p style={styles.historyWeather}>
                                            {rec.temperature}°C · {rec.weatherCondition}
                                        </p>
                                    )}
                                    {rec.description && (
                                        <p style={styles.historyDesc}>{rec.description}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 색상 어시스턴트 탭 */}
                {tab === '색상 어시스턴트' && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>색상 어시스턴트</h2>
                        <div style={styles.comingSoonBox}>
                            <p style={styles.comingSoonEmoji}>🎨</p>
                            <p style={styles.comingSoonTitle}>색상 어시스턴트</p>
                            <p style={styles.comingSoonDesc}>
                                퍼스널 컬러 분석 및 색각 보정 기능이 준비 중입니다.
                            </p>
                            <div style={styles.colorTypeBox}>
                                <p style={styles.colorTypeLabel}>현재 설정된 색상 유형</p>
                                <p style={styles.colorTypeValue}>
                                    {COLOR_TYPES.find(c => c.key === profile.colorType)?.label || '미설정'}
                                </p>
                                <button
                                    style={styles.setColorBtn}
                                    onClick={() => { setTab('프로필'); setEditMode(true); }}
                                >
                                    색상 유형 설정하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '800px', margin: '0 auto', padding: '32px 16px' },
    profileHeader: {
        display: 'flex', alignItems: 'center', gap: '20px',
        backgroundColor: 'white', borderRadius: '16px', padding: '24px',
        marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    avatar: {
        width: '72px', height: '72px', borderRadius: '50%',
        backgroundColor: '#333', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', fontWeight: 'bold', flexShrink: 0
    },
    nicknameLarge: { fontSize: '22px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    loginIdText: { fontSize: '14px', color: '#888', margin: '0 0 4px' },
    joinDate: { fontSize: '12px', color: '#aaa', margin: 0 },
    tabRow: {
        display: 'flex', gap: '0', marginBottom: '16px',
        backgroundColor: 'white', borderRadius: '12px', padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    },
    tabBtn: {
        flex: 1, padding: '12px', background: 'none', border: 'none',
        fontSize: '14px', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s'
    },
    section: {
        backgroundColor: 'white', borderRadius: '16px', padding: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionHeader: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '20px'
    },
    sectionTitle: { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 },
    editBtn: {
        padding: '8px 16px', backgroundColor: '#f0f0f0', color: '#333',
        border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
    },
    saveBtn: {
        padding: '8px 16px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
    },
    cancelBtn: {
        padding: '8px 16px', backgroundColor: '#f0f0f0', color: '#333',
        border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
    },
    profileInfo: {},
    infoRow: {
        display: 'flex', alignItems: 'center', padding: '12px 0',
        borderBottom: '1px solid #f5f5f5'
    },
    infoLabel: { width: '100px', fontSize: '14px', color: '#888', flexShrink: 0 },
    infoValue: { fontSize: '14px', color: '#333', fontWeight: '500' },
    styleChip: {
        padding: '4px 12px', backgroundColor: '#f0f0f0', borderRadius: '12px',
        fontSize: '13px', color: '#333'
    },
    editForm: {},
    editLabel: { fontSize: '13px', color: '#888', display: 'block', marginBottom: '6px', marginTop: '12px' },
    editInput: {
        width: '100%', padding: '10px 12px', borderRadius: '8px',
        border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box'
    },
    styleGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    styleToggle: {
        padding: '8px 14px', borderRadius: '20px',
        border: 'none', cursor: 'pointer', fontSize: '13px'
    },
    emptyText: { color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '32px 0' },
    historyCard: {
        backgroundColor: '#f9f9f9', borderRadius: '12px',
        padding: '16px', marginBottom: '12px'
    },
    historyTop: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '8px'
    },
    historyTpo: {
        fontSize: '15px', fontWeight: 'bold', color: '#333',
        backgroundColor: '#e8e8e8', padding: '4px 12px', borderRadius: '12px'
    },
    historyDate: { fontSize: '12px', color: '#aaa' },
    historyStyle: {
        fontSize: '12px', color: '#666', backgroundColor: '#f0f0f0',
        padding: '2px 10px', borderRadius: '10px', display: 'inline-block', marginBottom: '6px'
    },
    historyWeather: { fontSize: '13px', color: '#888', margin: '4px 0' },
    historyDesc: { fontSize: '13px', color: '#555', lineHeight: '1.6', margin: '6px 0 0' },
    comingSoonBox: { textAlign: 'center', padding: '32px 0' },
    comingSoonEmoji: { fontSize: '48px', margin: '0 0 12px' },
    comingSoonTitle: { fontSize: '20px', fontWeight: 'bold', color: '#333', margin: '0 0 8px' },
    comingSoonDesc: { fontSize: '14px', color: '#888', margin: '0 0 24px' },
    colorTypeBox: {
        backgroundColor: '#f9f9f9', borderRadius: '12px',
        padding: '20px', display: 'inline-block', minWidth: '200px'
    },
    colorTypeLabel: { fontSize: '13px', color: '#888', margin: '0 0 8px' },
    colorTypeValue: { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: '0 0 16px' },
    setColorBtn: {
        padding: '10px 20px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
    }
};

export default MyPage;