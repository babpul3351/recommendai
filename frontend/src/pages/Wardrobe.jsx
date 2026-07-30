import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI, userAPI } from '../api/api';
import { theme } from '../styles/theme';
import DaltonizedImage from '../components/DaltonizedImage';

/*
 * 변경 사항 (기존 대비)
 * ------------------
 * 1. correctionEnabled를 더 이상 useState(false)로 초기화하지 않고,
 *    서버(/user/profile 응답의 correctionEnabled)에서 가져온 값을 그대로 사용합니다.
 *    → 이전에는 화면 재진입 시마다 매번 false로 초기화된 뒤 colorType이 있으면
 *      자동으로 true가 되어버려, 사용자가 꺼둔 설정이 유지되지 않았습니다.
 *
 * 2. 토글 클릭 시 handleToggleCorrection()이 서버에 즉시 저장합니다.
 *    (PUT /user/profile 로 correctionEnabled 값 전송)
 */

const CATEGORIES = ['상의', '하의', '아우터', '원피스', '기타'];
const COLORS = ['블랙', '화이트', '그레이', '네이비', '블루', '레드', '핑크',
    '옐로우', '그린', '카키', '브라운', '갈색', '베이지', '퍼플', '오렌지',
    '와인', '민트', '코랄', '머스타드', '아이보리'];
const MATERIALS = ['코튼', '데님', '니트', '가죽', '린넨', '폴리에스터', '울', '시폰', '기타'];

const COLOR_TYPE_LABEL = {
    protanopia: '제1색맹(적록)',
    deuteranopia: '제2색맹(적록)',
    tritanopia: '제3색맹(청황)',
};

function Wardrobe() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const fileInputRef = useRef(null);

    // ── 색각 보정 ──────────────────────────────
    const [colorType, setColorType] = useState(null);
    const [correctionEnabled, setCorrectionEnabled] = useState(false);
    const [savingToggle, setSavingToggle] = useState(false);
    // ──────────────────────────────────────────

    const categories = ['전체', ...CATEGORIES];

    useEffect(() => {
        fetchWardrobe();
        fetchUserColorType();
    }, []);

    // 로그인한 사용자의 colorType과 correctionEnabled를 /api/user/profile에서 가져옴
    const fetchUserColorType = async () => {
        try {
            const res = await userAPI.getProfile();
            setColorType(res.data.colorType);
            // [변경] 서버에 저장된 값을 그대로 사용 (자동으로 true로 덮어쓰지 않음)
            setCorrectionEnabled(!!res.data.correctionEnabled);
        } catch (err) {
            console.error('프로필 조회 실패', err);
        }
    };

    // [신규] 토글 클릭 시 서버에 즉시 저장
    const handleToggleCorrection = async () => {
        if (savingToggle) return;
        const next = !correctionEnabled;

        setCorrectionEnabled(next);
        setSavingToggle(true);

        try {
            await userAPI.updateProfile({ correctionEnabled: next });
        } catch (err) {
            console.error('보정 설정 저장 실패', err);
            setCorrectionEnabled(!next);
            alert('설정 저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setSavingToggle(false);
        }
    };

    const fetchWardrobe = async () => {
        setLoading(true);
        try {
            const res = await wardrobeAPI.getWardrobe();
            setItems(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                await wardrobeAPI.uploadItem(reader.result);
                await fetchWardrobe();
                alert('업로드 완료');
            };
            reader.readAsDataURL(file);
        } catch (err) { alert('업로드 실패'); }
        finally { setUploading(false); e.target.value = ''; }
    };

    const handleDelete = async (itemId) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await wardrobeAPI.deleteItem(itemId);
            setItems(items.filter(item => item.id !== itemId));
            setSelectedItem(null);
        } catch (err) { alert('삭제 실패'); }
    };

    const handleEdit = async () => {
        try {
            await wardrobeAPI.updateItem(selectedItem.id, editForm);
            await fetchWardrobe();
            setEditMode(false);
            setSelectedItem(prev => ({ ...prev, ...editForm }));
            alert('수정됐습니다.');
        } catch (err) { alert('수정 실패'); }
    };

    const openPopup = (item) => {
        setSelectedItem(item);
        setEditForm({
            category: normalizeCategory(item.category),
            type: item.type || '',
            color: item.color || '',
            material: item.material || ''
        });
        setEditMode(false);
    };

    const normalizeCategory = (category) => {
        if (!category) return '기타';
        const c = category.trim();
        if (['상의','탑','top','TOP','티셔츠','셔츠','니트','블라우스','후드','맨투맨'].some(k => c.includes(k))) return '상의';
        if (['하의','팬츠','바지','스커트','반바지','bottom','BOTTOM'].some(k => c.includes(k))) return '하의';
        if (['아우터','자켓','재킷','코트','패딩','점퍼','가디건','outer','OUTER'].some(k => c.includes(k))) return '아우터';
        if (['원피스','드레스','dress','DRESS'].some(k => c.includes(k))) return '원피스';
        return c;
    };

    const filteredItems = selectedCategory === '전체'
        ? items
        : items.filter(item => normalizeCategory(item.category) === selectedCategory);

    const getCategoryCount = (cat) => {
        if (cat === '전체') return items.length;
        return items.filter(item => normalizeCategory(item.category) === cat).length;
    };

    const getColorHex = (colorName) => {
        const map = {
            '블랙': '#1a1a1a', '검정': '#1a1a1a',
            '화이트': '#f5f5f5', '흰색': '#f5f5f5', '흰': '#f5f5f5',
            '그레이': '#95a5a6', '회색': '#95a5a6',
            '아이보리': '#f5f0dc', '크림': '#fffdd0',
            '네이비': '#1a2a5e', '남색': '#1a2a5e',
            '블루': '#3498db', '파랑': '#3498db', '파란': '#3498db',
            '하늘': '#87CEEB', '스카이': '#87CEEB',
            '청': '#4169E1',
            '레드': '#e74c3c', '빨강': '#e74c3c', '빨간': '#e74c3c', '적색': '#e74c3c',
            '핑크': '#ff6b9d', '분홍': '#ff6b9d',
            '코랄': '#FF6B6B', '살구': '#FDBCB4',
            '와인': '#722F37', '버건디': '#800020', '마룬': '#800000',
            '옐로우': '#f1c40f', '노랑': '#f1c40f', '노란': '#f1c40f', '황색': '#f1c40f',
            '오렌지': '#e67e22', '주황': '#e67e22',
            '머스타드': '#FFDB58',
            '그린': '#2ecc71', '초록': '#2ecc71', '녹색': '#2ecc71',
            '카키': '#8B8B6A', '올리브': '#808000',
            '민트': '#98FF98', '연두': '#90EE90',
            '브라운': '#8B4513',
            '갈색': '#8B4513', '갈': '#8B4513',
            '카멜': '#C19A6B', '카라멜': '#C19A6B',
            '베이지': '#f5f0e8', '샌드': '#C2B280',
            '탄': '#D2B48C', '누드': '#E8C9A0',
            '퍼플': '#9b59b6', '보라': '#9b59b6', '자주': '#800080',
            '라벤더': '#E6E6FA', '연보라': '#DDA0DD',
            '바이올렛': '#EE82EE',
            '실버': '#C0C0C0', '골드': '#FFD700',
        };

        if (!colorName) return '#e0e0e0';
        for (const [key, val] of Object.entries(map)) {
            if (colorName.includes(key)) return val;
        }
        return '#e0e0e0';
    };

    const hasColorDeficiency = colorType && colorType !== 'normal';

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>내 옷장</h1>
                        <p style={styles.subtitle}>총 {items.length}벌</p>
                    </div>
                    <button style={styles.uploadBtn}
                            onClick={() => fileInputRef.current.click()}
                            disabled={uploading}>
                        {uploading ? '업로드 중...' : '+ 옷 추가'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*"
                           style={{ display: 'none' }} onChange={handleFileChange} />
                </div>

                {/* 색각 보정 토글 배너 — 색각 이상 사용자에게만 표시 */}
                {hasColorDeficiency && (
                    <div style={{
                        ...styles.correctionBanner,
                        backgroundColor: correctionEnabled
                            ? theme.colors.primaryLight
                            : '#f5f5f5',
                        borderColor: correctionEnabled
                            ? theme.colors.primary
                            : '#e0e0e0',
                    }}>
                        <div>
                            <span style={styles.correctionTitle}>색약 보정 모드</span>
                            <span style={styles.correctionSub}>
                                {COLOR_TYPE_LABEL[colorType]}
                            </span>
                        </div>
                        <div style={{
                            ...styles.toggleWrapper,
                            opacity: savingToggle ? 0.6 : 1,
                            pointerEvents: savingToggle ? 'none' : 'auto',
                        }}
                             onClick={handleToggleCorrection}>
                            <span style={{
                                fontSize: '12px',
                                color: correctionEnabled
                                    ? theme.colors.primary
                                    : theme.colors.textSub,
                                fontWeight: correctionEnabled ? '600' : '400'
                            }}>
                                {correctionEnabled ? 'ON' : 'OFF'}
                            </span>
                            <div style={{
                                ...styles.toggleTrack,
                                backgroundColor: correctionEnabled
                                    ? theme.colors.primary
                                    : '#ccc',
                            }}>
                                <div style={{
                                    ...styles.toggleThumb,
                                    left: correctionEnabled ? '22px' : '2px',
                                }} />
                            </div>
                        </div>
                    </div>
                )}

                <div style={styles.filterRow}>
                    {categories.map(cat => (
                        <button key={cat} style={{
                            ...styles.filterBtn,
                            backgroundColor: selectedCategory === cat ? theme.colors.primary : theme.colors.white,
                            color: selectedCategory === cat ? theme.colors.white : theme.colors.textSub,
                            boxShadow: selectedCategory === cat ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
                        }} onClick={() => setSelectedCategory(cat)}>
                            {cat}
                            <span style={{
                                ...styles.categoryCount,
                                backgroundColor: selectedCategory === cat ? 'rgba(255,255,255,0.3)' : theme.colors.primaryLight,
                                color: selectedCategory === cat ? theme.colors.white : theme.colors.primary
                            }}>
                                {getCategoryCount(cat)}
                            </span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={styles.emptyBox}>
                        <p style={styles.emptyText}>불러오는 중...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={styles.emptyBox}>
                        <p style={styles.emptyEmoji}>👗</p>
                        <p style={styles.emptyText}>
                            {selectedCategory === '전체'
                                ? '옷장이 비어있습니다.'
                                : `${selectedCategory} 카테고리에 옷이 없습니다.`}
                        </p>
                        <p style={styles.emptySubText}>오른쪽 상단 버튼으로 옷을 추가해보세요</p>
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {filteredItems.map(item => (
                            <div key={item.id} style={styles.card} onClick={() => openPopup(item)}>
                                {item.imageUrl ? (
                                    <DaltonizedImage
                                        src={item.imageUrl}
                                        alt={item.type}
                                        colorType={colorType}
                                        correctionEnabled={correctionEnabled}
                                        imgStyle={styles.image}
                                    />
                                ) : (
                                    <div style={styles.imagePlaceholder}>
                                        <span style={{ fontSize: '32px' }}>👗</span>
                                    </div>
                                )}
                                <div style={styles.cardInfo}>
                                    <span style={styles.cardCategory}>
                                        {normalizeCategory(item.category)}
                                    </span>
                                    <p style={styles.cardType}>{item.type}</p>
                                    <div style={styles.cardColorRow}>
                                        <div style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            backgroundColor: getColorHex(item.color),
                                            border: '1px solid #e0e0e0', flexShrink: 0
                                        }} />
                                        <span style={styles.cardColor}>{item.color}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedItem && (
                <>
                    <div style={styles.overlay}
                         onClick={() => { setSelectedItem(null); setEditMode(false); }} />
                    <div style={styles.popup}>
                        <div style={styles.popupHeader}>
                            <h2 style={styles.popupTitle}>옷 상세 정보</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {!editMode ? (
                                    <button style={styles.editBtn}
                                            onClick={() => setEditMode(true)}>수정</button>
                                ) : (
                                    <>
                                        <button style={styles.saveBtn}
                                                onClick={handleEdit}>저장</button>
                                        <button style={styles.cancelBtn}
                                                onClick={() => setEditMode(false)}>취소</button>
                                    </>
                                )}
                                <button style={styles.closeBtn}
                                        onClick={() => { setSelectedItem(null); setEditMode(false); }}>
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={styles.popupImageBox}>
                            {selectedItem.imageUrl ? (
                                <DaltonizedImage
                                    src={selectedItem.imageUrl}
                                    alt={selectedItem.type}
                                    colorType={colorType}
                                    correctionEnabled={correctionEnabled}
                                    imgStyle={styles.popupImage}
                                />
                            ) : (
                                <div style={styles.popupImagePlaceholder}>
                                    <span style={{ fontSize: '48px' }}>👗</span>
                                </div>
                            )}
                        </div>

                        {!editMode ? (
                            <div style={styles.popupInfo}>
                                {[
                                    { label: '카테고리', value: normalizeCategory(selectedItem.category) },
                                    { label: '종류', value: selectedItem.type || '-' },
                                    { label: '소재', value: selectedItem.material || '-' },
                                ].map(row => (
                                    <div key={row.label} style={styles.infoRow}>
                                        <span style={styles.infoLabel}>{row.label}</span>
                                        <span style={styles.infoValue}>{row.value}</span>
                                    </div>
                                ))}
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>색상</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '16px', height: '16px', borderRadius: '50%',
                                            backgroundColor: getColorHex(selectedItem.color),
                                            border: '1px solid #e0e0e0'
                                        }} />
                                        <span style={styles.infoValue}>{selectedItem.color || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.popupInfo}>
                                <div style={styles.editRow}>
                                    <span style={styles.infoLabel}>카테고리</span>
                                    <select style={styles.editSelect} value={editForm.category}
                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div style={styles.editRow}>
                                    <span style={styles.infoLabel}>종류</span>
                                    <input style={styles.editInput} value={editForm.type}
                                           onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                                           placeholder="예: 티셔츠, 청바지" />
                                </div>
                                <div style={styles.editRow}>
                                    <span style={styles.infoLabel}>색상</span>
                                    <div style={{ flex: 1 }}>
                                        <select style={styles.editSelect} value={editForm.color}
                                                onChange={e => setEditForm({ ...editForm, color: e.target.value })}>
                                            <option value="">선택</option>
                                            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <input style={{ ...styles.editInput, marginTop: '6px' }}
                                               value={editForm.color}
                                               onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                               placeholder="직접 입력" />
                                    </div>
                                </div>
                                <div style={styles.editRow}>
                                    <span style={styles.infoLabel}>소재</span>
                                    <select style={styles.editSelect} value={editForm.material}
                                            onChange={e => setEditForm({ ...editForm, material: e.target.value })}>
                                        <option value="">선택</option>
                                        {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button style={styles.deleteBtn}
                                onClick={() => handleDelete(selectedItem.id)}>
                            옷장에서 삭제
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    page: { backgroundColor: theme.colors.background, minHeight: '100vh' },
    container: { maxWidth: '480px', margin: '0 auto', padding: '20px 20px 90px' },
    header: {
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '20px'
    },
    title: { fontSize: '22px', fontWeight: '700', color: theme.colors.text, margin: '0 0 4px' },
    subtitle: { fontSize: '13px', color: theme.colors.textSub, margin: 0 },
    uploadBtn: {
        padding: '10px 18px', backgroundColor: theme.colors.primary, color: theme.colors.white,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px',
        cursor: 'pointer', fontWeight: '600', flexShrink: 0
    },

    correctionBanner: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: theme.radius.lg,
        border: '1px solid', marginBottom: '16px',
        transition: 'background-color 0.2s, border-color 0.2s'
    },
    correctionTitle: {
        fontSize: '13px', fontWeight: '600', color: theme.colors.primary, marginRight: '6px'
    },
    correctionSub: { fontSize: '12px', color: theme.colors.textSub },
    toggleWrapper: {
        display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer'
    },
    toggleTrack: {
        width: '44px', height: '24px', borderRadius: '12px',
        position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
    },
    toggleThumb: {
        position: 'absolute', top: '2px', width: '20px', height: '20px',
        borderRadius: '50%', backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s'
    },

    filterRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
    filterBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 12px', border: 'none', borderRadius: theme.radius.full,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    categoryCount: {
        padding: '1px 7px', borderRadius: theme.radius.full,
        fontSize: '11px', fontWeight: '600'
    },
    emptyBox: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        padding: '60px', textAlign: 'center', boxShadow: theme.colors.cardShadow
    },
    emptyEmoji: { fontSize: '48px', margin: '0 0 12px' },
    emptyText: { color: theme.colors.text, fontSize: '15px', fontWeight: '500', margin: '0 0 8px' },
    emptySubText: { color: theme.colors.textLight, fontSize: '13px', margin: 0 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
    card: {
        backgroundColor: theme.colors.white, borderRadius: theme.radius.lg,
        overflow: 'hidden', boxShadow: theme.colors.cardShadow, cursor: 'pointer'
    },
    image: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
    imagePlaceholder: {
        width: '100%', height: '180px', backgroundColor: theme.colors.primaryLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { padding: '10px 12px' },
    cardCategory: {
        fontSize: '10px', color: theme.colors.primary, backgroundColor: theme.colors.primaryLight,
        padding: '2px 8px', borderRadius: theme.radius.full,
        display: 'inline-block', marginBottom: '6px', fontWeight: '600'
    },
    cardType: { fontSize: '14px', fontWeight: '600', color: theme.colors.text, margin: '0 0 4px' },
    cardColorRow: { display: 'flex', alignItems: 'center', gap: '5px' },
    cardColor: { fontSize: '12px', color: theme.colors.textSub },
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200
    },
    popup: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.white, borderRadius: theme.radius.xl,
        width: '360px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    },
    popupHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 20px 0', marginBottom: '16px'
    },
    popupTitle: { fontSize: '17px', fontWeight: '700', color: theme.colors.text, margin: 0 },
    editBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.primaryLight, color: theme.colors.primary,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px',
        cursor: 'pointer', fontWeight: '500'
    },
    saveBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.primary, color: theme.colors.white,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px',
        cursor: 'pointer', fontWeight: '600'
    },
    cancelBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.background, color: theme.colors.textSub,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer'
    },
    closeBtn: {
        background: 'none', border: 'none', fontSize: '18px', color: '#999', cursor: 'pointer'
    },
    popupImageBox: { padding: '0 20px', marginBottom: '16px' },
    popupImage: {
        width: '100%', height: '260px', objectFit: 'cover',
        borderRadius: theme.radius.lg, display: 'block'
    },
    popupImagePlaceholder: {
        width: '100%', height: '260px', backgroundColor: theme.colors.primaryLight,
        borderRadius: theme.radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    popupInfo: { padding: '0 20px', marginBottom: '16px' },
    infoRow: {
        display: 'flex', alignItems: 'center', padding: '11px 0',
        borderBottom: `1px solid ${theme.colors.border}`
    },
    editRow: {
        display: 'flex', alignItems: 'flex-start', padding: '11px 0',
        borderBottom: `1px solid ${theme.colors.border}`, gap: '12px'
    },
    infoLabel: {
        width: '70px', fontSize: '13px', color: theme.colors.textSub,
        flexShrink: 0, paddingTop: '2px'
    },
    infoValue: { fontSize: '14px', color: theme.colors.text, fontWeight: '500' },
    editSelect: {
        flex: 1, width: '100%', padding: '8px 10px', borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`, fontSize: '14px',
        backgroundColor: theme.colors.white
    },
    editInput: {
        flex: 1, width: '100%', padding: '8px 10px', borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`, fontSize: '14px', boxSizing: 'border-box'
    },
    deleteBtn: {
        width: 'calc(100% - 40px)', margin: '0 20px 20px', padding: '12px',
        backgroundColor: theme.colors.white, color: theme.colors.danger,
        border: `1px solid ${theme.colors.danger}`, borderRadius: theme.radius.lg,
        fontSize: '14px', cursor: 'pointer', fontWeight: '500'
    }
};

export default Wardrobe;