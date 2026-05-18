import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI } from '../api/api';
import { theme } from '../styles/theme';

const CATEGORIES = ['상의', '하의', '아우터', '원피스', '기타'];
const COLORS = ['블랙', '화이트', '그레이', '네이비', '블루', '레드', '핑크',
    '옐로우', '그린', '카키', '브라운', '베이지', '퍼플', '오렌지'];
const MATERIALS = ['코튼', '데님', '니트', '가죽', '린넨', '폴리에스터', '울', '시폰', '기타'];

function Wardrobe() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const fileInputRef = useRef(null);

    const categories = ['전체', ...CATEGORIES];

    useEffect(() => { fetchWardrobe(); }, []);

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
            '블랙':'#1a1a1a','화이트':'#f5f5f5','그레이':'#95a5a6','네이비':'#1a2a5e',
            '블루':'#3498db','레드':'#e74c3c','핑크':'#ff6b9d','옐로우':'#f1c40f',
            '그린':'#2ecc71','카키':'#8B8B6A','브라운':'#8B4513','베이지':'#f5f0e8',
            '퍼플':'#9b59b6','오렌지':'#e67e22'
        };
        if (!colorName) return '#e0e0e0';
        for (const [key, val] of Object.entries(map)) {
            if (colorName.includes(key)) return val;
        }
        return '#e0e0e0';
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>

                {/* 헤더 */}
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

                {/* 카테고리 필터 */}
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

                {/* 그리드 */}
                {loading ? (
                    <div style={styles.emptyBox}>
                        <p style={styles.emptyText}>불러오는 중...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={styles.emptyBox}>
                        <p style={styles.emptyEmoji}>👗</p>
                        <p style={styles.emptyText}>
                            {selectedCategory === '전체' ? '옷장이 비어있습니다.' : `${selectedCategory} 카테고리에 옷이 없습니다.`}
                        </p>
                        <p style={styles.emptySubText}>오른쪽 상단 버튼으로 옷을 추가해보세요</p>
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {filteredItems.map(item => (
                            <div key={item.id} style={styles.card} onClick={() => openPopup(item)}>
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.type} style={styles.image} />
                                ) : (
                                    <div style={styles.imagePlaceholder}>
                                        <span style={{ fontSize: '32px' }}>👗</span>
                                    </div>
                                )}
                                <div style={styles.cardInfo}>
                                    <span style={styles.cardCategory}>{normalizeCategory(item.category)}</span>
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

            {/* 상세 팝업 */}
            {selectedItem && (
                <>
                    <div style={styles.overlay} onClick={() => { setSelectedItem(null); setEditMode(false); }} />
                    <div style={styles.popup}>
                        <div style={styles.popupHeader}>
                            <h2 style={styles.popupTitle}>옷 상세 정보</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {!editMode ? (
                                    <button style={styles.editBtn} onClick={() => setEditMode(true)}>수정</button>
                                ) : (
                                    <>
                                        <button style={styles.saveBtn} onClick={handleEdit}>저장</button>
                                        <button style={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                                    </>
                                )}
                                <button style={styles.closeBtn}
                                        onClick={() => { setSelectedItem(null); setEditMode(false); }}>✕</button>
                            </div>
                        </div>

                        <div style={styles.popupImageBox}>
                            {selectedItem.imageUrl ? (
                                <img src={selectedItem.imageUrl} alt={selectedItem.type} style={styles.popupImage} />
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

                        <button style={styles.deleteBtn} onClick={() => handleDelete(selectedItem.id)}>
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
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
    title: { fontSize: '22px', fontWeight: '700', color: theme.colors.text, margin: '0 0 4px' },
    subtitle: { fontSize: '13px', color: theme.colors.textSub, margin: 0 },
    uploadBtn: {
        padding: '10px 18px', backgroundColor: theme.colors.primary, color: theme.colors.white,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px',
        cursor: 'pointer', fontWeight: '600', flexShrink: 0
    },
    filterRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
    filterBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 12px', border: 'none', borderRadius: theme.radius.full,
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    categoryCount: {
        padding: '1px 7px', borderRadius: theme.radius.full, fontSize: '11px', fontWeight: '600'
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
        backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, overflow: 'hidden',
        boxShadow: theme.colors.cardShadow, cursor: 'pointer'
    },
    image: { width: '100%', height: '180px', objectFit: 'cover' },
    imagePlaceholder: {
        width: '100%', height: '180px', backgroundColor: theme.colors.primaryLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { padding: '10px 12px' },
    cardCategory: {
        fontSize: '10px', color: theme.colors.primary, backgroundColor: theme.colors.primaryLight,
        padding: '2px 8px', borderRadius: theme.radius.full, display: 'inline-block', marginBottom: '6px',
        fontWeight: '600'
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
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    saveBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.primary, color: theme.colors.white,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer', fontWeight: '600'
    },
    cancelBtn: {
        padding: '6px 14px', backgroundColor: theme.colors.background, color: theme.colors.textSub,
        border: 'none', borderRadius: theme.radius.full, fontSize: '13px', cursor: 'pointer'
    },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', color: '#999', cursor: 'pointer' },
    popupImageBox: { padding: '0 20px', marginBottom: '16px' },
    popupImage: { width: '100%', height: '260px', objectFit: 'cover', borderRadius: theme.radius.lg },
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
    infoLabel: { width: '70px', fontSize: '13px', color: theme.colors.textSub, flexShrink: 0, paddingTop: '2px' },
    infoValue: { fontSize: '14px', color: theme.colors.text, fontWeight: '500' },
    editSelect: {
        flex: 1, width: '100%', padding: '8px 10px', borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`, fontSize: '14px', backgroundColor: theme.colors.white
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