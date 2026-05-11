import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI } from '../api/api';

function Wardrobe() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedItem, setSelectedItem] = useState(null);
    const fileInputRef = useRef(null);

    const categories = ['전체', '상의', '하의', '아우터', '원피스', '기타'];

    useEffect(() => {
        fetchWardrobe();
    }, []);

    const fetchWardrobe = async () => {
        setLoading(true);
        try {
            const res = await wardrobeAPI.getWardrobe();
            setItems(res.data);
        } catch (err) {
            console.error('옷장 조회 실패', err);
        } finally {
            setLoading(false);
        }
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
        } catch (err) {
            alert('업로드 실패');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (itemId) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await wardrobeAPI.deleteItem(itemId);
            setItems(items.filter(item => item.id !== itemId));
            setSelectedItem(null);
        } catch (err) {
            alert('삭제 실패');
        }
    };

    // 카테고리 정규화 함수
    const normalizeCategory = (category) => {
        if (!category) return '기타';
        const c = category.trim();
        if (['상의', '탑', 'top', 'TOP', '티셔츠', '셔츠', '니트', '블라우스', '후드', '맨투맨'].some(k => c.includes(k))) return '상의';
        if (['하의', '팬츠', '바지', '스커트', '반바지', 'bottom', 'BOTTOM'].some(k => c.includes(k))) return '하의';
        if (['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건', 'outer', 'OUTER'].some(k => c.includes(k))) return '아우터';
        if (['원피스', '드레스', 'dress', 'DRESS'].some(k => c.includes(k))) return '원피스';
        return c;
    };

    const filteredItems = selectedCategory === '전체'
        ? items
        : items.filter(item => normalizeCategory(item.category) === selectedCategory);

    const getCategoryCount = (cat) => {
        if (cat === '전체') return items.length;
        return items.filter(item => normalizeCategory(item.category) === cat).length;
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
                    <button
                        style={styles.uploadBtn}
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading}
                    >
                        {uploading ? '업로드 중...' : '+ 옷 추가'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>

                {/* 카테고리 필터 */}
                <div style={styles.filterRow}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            style={{
                                ...styles.filterBtn,
                                backgroundColor: selectedCategory === cat ? '#333' : 'white',
                                color: selectedCategory === cat ? 'white' : '#555',
                                boxShadow: selectedCategory === cat
                                    ? 'none'
                                    : '0 1px 4px rgba(0,0,0,0.08)'
                            }}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                            <span style={{
                                ...styles.categoryCount,
                                backgroundColor: selectedCategory === cat ? 'rgba(255,255,255,0.25)' : '#f0f0f0',
                                color: selectedCategory === cat ? 'white' : '#888'
                            }}>
                                {getCategoryCount(cat)}
                            </span>
                        </button>
                    ))}
                </div>

                {/* 옷장 그리드 */}
                {loading ? (
                    <div style={styles.loadingBox}>
                        <p style={styles.loadingText}>불러오는 중...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={styles.emptyBox}>
                        {/*<p style={styles.emptyEmoji}>👗</p>*/}
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
                            <div
                                key={item.id}
                                style={styles.card}
                                onClick={() => setSelectedItem(item)}
                            >
                                {item.imageB64 ? (
                                    <img src={item.imageB64} alt={item.type} style={styles.image} />
                                ) : (
                                    <div style={styles.imagePlaceholder}>
                                        <p style={{ color: '#ccc', fontSize: '32px' }}>👗</p>
                                    </div>
                                )}
                                <div style={styles.cardInfo}>
                                    <span style={styles.cardCategory}>
                                        {normalizeCategory(item.category)}
                                    </span>
                                    <p style={styles.cardType}>{item.type}</p>
                                    <p style={styles.cardColor}>{item.color}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 상세 정보 팝업 */}
            {selectedItem && (
                <>
                    <div style={styles.overlay} onClick={() => setSelectedItem(null)} />
                    <div style={styles.popup}>
                        {/* 팝업 헤더 */}
                        <div style={styles.popupHeader}>
                            <h2 style={styles.popupTitle}>옷 상세 정보</h2>
                            <button style={styles.closeBtn} onClick={() => setSelectedItem(null)}>✕</button>
                        </div>

                        {/* 이미지 */}
                        <div style={styles.popupImageBox}>
                            {selectedItem.imageB64 ? (
                                <img
                                    src={selectedItem.imageB64}
                                    alt={selectedItem.type}
                                    style={styles.popupImage}
                                />
                            ) : (
                                <div style={styles.popupImagePlaceholder}>
                                    <p style={{ fontSize: '48px' }}>👗</p>
                                </div>
                            )}
                        </div>

                        {/* 정보 */}
                        <div style={styles.popupInfo}>
                            <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>카테고리</span>
                                <span style={styles.infoValue}>
                                    {normalizeCategory(selectedItem.category)}
                                </span>
                            </div>
                            <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>종류</span>
                                <span style={styles.infoValue}>{selectedItem.type || '-'}</span>
                            </div>
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
                            {selectedItem.material && (
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>소재</span>
                                    <span style={styles.infoValue}>{selectedItem.material}</span>
                                </div>
                            )}
                        </div>

                        {/* 삭제 버튼 */}
                        <button
                            style={styles.deleteBtn}
                            onClick={() => handleDelete(selectedItem.id)}
                        >
                            옷장에서 삭제
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// 색상명 → HEX 변환
function getColorHex(colorName) {
    const map = {
        '블랙': '#1a1a1a', '검정': '#1a1a1a', '화이트': '#ffffff', '흰색': '#ffffff',
        '레드': '#e74c3c', '빨강': '#e74c3c', '블루': '#3498db', '파랑': '#3498db',
        '네이비': '#1a2a5e', '그린': '#2ecc71', '초록': '#2ecc71', '옐로우': '#f1c40f',
        '노랑': '#f1c40f', '핑크': '#ff6b9d', '퍼플': '#9b59b6', '보라': '#9b59b6',
        '오렌지': '#e67e22', '브라운': '#8B4513', '갈색': '#8B4513', '베이지': '#f5f0e8',
        '그레이': '#95a5a6', '회색': '#95a5a6', '카키': '#8B8B6A', '민트': '#00b894',
        '크림': '#fffdd0', '연청': '#a8c8e8', '블랙진': '#1a1a1a', '인디고': '#3d3d8f'
    };
    if (!colorName) return '#e0e0e0';
    for (const [key, val] of Object.entries(map)) {
        if (colorName.includes(key)) return val;
    }
    return '#e0e0e0';
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' },
    header: {
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '20px'
    },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    subtitle: { fontSize: '13px', color: '#888', margin: 0 },
    uploadBtn: {
        padding: '10px 20px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '14px',
        cursor: 'pointer', fontWeight: '500', flexShrink: 0
    },
    filterRow: {
        display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap'
    },
    filterBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', border: 'none', borderRadius: '20px',
        fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s'
    },
    categoryCount: {
        padding: '1px 7px', borderRadius: '10px',
        fontSize: '11px', fontWeight: '600'
    },
    loadingBox: { textAlign: 'center', padding: '60px 0' },
    loadingText: { color: '#888', fontSize: '15px' },
    emptyBox: {
        backgroundColor: 'white', borderRadius: '16px',
        padding: '60px', textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    emptyEmoji: { fontSize: '48px', margin: '0 0 12px' },
    emptyText: { color: '#555', fontSize: '16px', fontWeight: '500', margin: '0 0 8px' },
    emptySubText: { color: '#aaa', fontSize: '13px', margin: 0 },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px'
    },
    card: {
        backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
    },
    image: { width: '100%', height: '200px', objectFit: 'cover' },
    imagePlaceholder: {
        width: '100%', height: '200px', backgroundColor: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { padding: '10px 12px' },
    cardCategory: {
        fontSize: '11px', color: '#888', backgroundColor: '#f0f0f0',
        padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginBottom: '6px'
    },
    cardType: { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '0 0 3px' },
    cardColor: { fontSize: '12px', color: '#666', margin: 0 },

    // 팝업
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200
    },
    popup: {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white', borderRadius: '20px',
        width: '360px', maxWidth: '90vw',
        maxHeight: '85vh', overflowY: 'auto',
        zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    popupHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 20px 0', marginBottom: '16px'
    },
    popupTitle: { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 },
    closeBtn: {
        background: 'none', border: 'none', fontSize: '18px',
        color: '#999', cursor: 'pointer', padding: '4px'
    },
    popupImageBox: { padding: '0 20px', marginBottom: '16px' },
    popupImage: {
        width: '100%', height: '280px', objectFit: 'cover', borderRadius: '12px'
    },
    popupImagePlaceholder: {
        width: '100%', height: '280px', backgroundColor: '#f5f5f5',
        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    popupInfo: { padding: '0 20px', marginBottom: '20px' },
    infoRow: {
        display: 'flex', alignItems: 'center', padding: '12px 0',
        borderBottom: '1px solid #f5f5f5'
    },
    infoLabel: { width: '80px', fontSize: '13px', color: '#888', flexShrink: 0 },
    infoValue: { fontSize: '14px', color: '#333', fontWeight: '500' },
    deleteBtn: {
        width: 'calc(100% - 40px)', margin: '0 20px 20px',
        padding: '12px', backgroundColor: 'white', color: '#FF3B30',
        border: '1px solid #FF3B30', borderRadius: '10px',
        fontSize: '14px', cursor: 'pointer', fontWeight: '500'
    }
};

export default Wardrobe;