import React, { useEffect, useState, useRef } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { wardrobeAPI, userAPI } from '../api/api';
import DaltonizedImage from '../components/DaltonizedImage';

const CATEGORIES = ['상의', '하의', '아우터', '원피스', '기타'];
const COLORS = ['블랙', '화이트', '그레이', '네이비', '블루', '레드', '핑크',
    '옐로우', '그린', '카키', '브라운', '갈색', '베이지', '퍼플', '오렌지',
    '와인', '민트', '코랄', '머스타드', '아이보리'];
const MATERIALS = ['코튼', '데님', '니트', '가죽', '린넨', '폴리에스터', '울', '시폰', '기타'];


interface WardrobeItem {
    id: number;
    imageUrl?: string;
    type?: string;
    category?: string;
    color?: string;
    material?: string;
}

interface EditForm {
    category: string;
    type: string;
    color: string;
    material: string;
}

function Wardrobe() {
    const pageRef = useRef<HTMLDivElement>(null);
    usePageAnimation(pageRef);
    const [items, setItems] = useState<WardrobeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({ category: '', type: '', color: '', material: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [colorType, setColorType] = useState<string | null>(null);
    const [correctionEnabled, setCorrectionEnabled] = useState(false);

    const categories = ['전체', '상의', '하의', '아우터', '원피스', '기타'];

    useEffect(() => {
        fetchWardrobe();
        fetchUserColorType();
    }, []);

    const fetchUserColorType = async () => {
        try {
            const res = await userAPI.getProfile();
            const ct: string = res.data.colorType;
            setColorType(ct);
            if (ct && ct !== 'normal') setCorrectionEnabled(true);
        } catch (err) { console.error(err); }
    };

    const fetchWardrobe = async () => {
        setLoading(true);
        try {
            const res = await wardrobeAPI.getWardrobe();
            setItems(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await wardrobeAPI.uploadItem(reader.result as string);
                await fetchWardrobe();
                alert('업로드 완료');
            } catch (err) {
                alert('업로드 실패');
            } finally {
                setUploading(false);
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDelete = async (itemId: number) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await wardrobeAPI.deleteItem(itemId);
            setItems(items.filter(item => item.id !== itemId));
            setSelectedItem(null);
        } catch (err) { alert('삭제 실패'); }
    };

    const handleEdit = async () => {
        if (!selectedItem) return;
        try {
            await wardrobeAPI.updateItem(selectedItem.id, editForm);
            await fetchWardrobe();
            setEditMode(false);
            setSelectedItem(prev => prev ? { ...prev, ...editForm } : null);
            alert('수정됐습니다.');
        } catch (err) { alert('수정 실패'); }
    };

    const openPopup = (item: WardrobeItem) => {
        setSelectedItem(item);
        setEditForm({ category: normalizeCategory(item.category), type: item.type || '', color: item.color || '', material: item.material || '' });
        setEditMode(false);
    };

    const normalizeCategory = (category?: string): string => {
        if (!category) return '기타';
        const c = category.trim();
        if (['상의', '탑', 'top', 'TOP', '티셔츠', '셔츠', '니트', '블라우스', '후드', '맨투맨'].some(k => c.includes(k))) return '상의';
        if (['하의', '팬츠', '바지', '스커트', '반바지', 'bottom', 'BOTTOM'].some(k => c.includes(k))) return '하의';
        if (['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건', 'outer', 'OUTER'].some(k => c.includes(k))) return '아우터';
        if (['원피스', '드레스', 'dress', 'DRESS'].some(k => c.includes(k))) return '원피스';
        return c;
    };

    const filteredItems = items.filter(i =>
        (selectedCategory === '전체' || normalizeCategory(i.category) === selectedCategory) &&
        (search === '' || (i.type || '').includes(search))
    );

    const getCategoryCount = (cat: string): number => {
        if (cat === '전체') return items.length;
        return items.filter(item => normalizeCategory(item.category) === cat).length;
    };

    const getColorHex = (colorName?: string): string => {
        const map: Record<string, string> = {
            '블랙': '#1a1a1a', '화이트': '#f5f5f5', '그레이': '#95a5a6',
            '아이보리': '#f5f0dc', '네이비': '#1a2a5e', '블루': '#3498db',
            '레드': '#e74c3c', '핑크': '#ff6b9d', '옐로우': '#f1c40f',
            '그린': '#2ecc71', '카키': '#8B8B6A', '브라운': '#8B4513',
            '베이지': '#f5f0e8', '퍼플': '#9b59b6', '오렌지': '#e67e22',
            '와인': '#722F37', '민트': '#98FF98', '코랄': '#FF6B6B', '머스타드': '#FFDB58',
        };
        if (!colorName) return '#e0e0e0';
        for (const [key, val] of Object.entries(map)) {
            if (colorName.includes(key)) return val;
        }
        return '#e0e0e0';
    };

    const hasColorDeficiency = colorType && colorType !== 'normal';

    const statsData = [
        { label: '전체 아이템', value: items.length, color: '#71b3e5' },
        { label: '즐겨찾기', value: getCategoryCount('즐겨찾기'), color: '#84c98e' },
        { label: '이번달 착용', value: getCategoryCount('이번달 착용'), color: '#d45acc' },
    ];

    return (
        <div ref={pageRef} style={{ padding: '70px 36px', maxWidth: 1100, width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <div style={{ overflow: 'hidden' }}>
                        <h1 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0, letterSpacing: '-0.5px' }}>
                            내 옷장
                        </h1>
                    </div>
                    <p data-sub style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#888', margin: '6px 0 0' }}>
                        {items.length}개의 아이템이 등록되어 있어요
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {hasColorDeficiency && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: correctionEnabled ? 'rgba(113,179,229,0.1)' : '#f5f5f5', border: `1px solid ${correctionEnabled ? '#71b3e5' : '#e0e0e0'}`, borderRadius: 12, padding: '8px 14px' }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: correctionEnabled ? '#71b3e5' : '#888' }}>
                                색약 보정 {correctionEnabled ? 'ON' : 'OFF'}
                            </span>
                            <button
                                onClick={() => setCorrectionEnabled(p => !p)}
                                style={{ width: 36, height: 20, borderRadius: 10, background: correctionEnabled ? '#71b3e5' : '#ccc', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                            >
                                <div style={{ position: 'absolute', top: 2, left: correctionEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {statsData.map(({ label, value, color }) => (
                    <div data-card key={label} style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid #eaedf2', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 18, color }}>{value}</span>
                        </div>
                        <span style={{ fontFamily: 'Kedebideri, sans-serif', fontWeight: 400, fontSize: 13, color: '#666' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Search + filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 260, flexShrink: 0, background: 'white', border: '1px solid #eaedf2', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#aaa', fontSize: 14 }}>🔍</span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="아이템 검색..."
                        style={{ border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#333', background: 'transparent', flex: 1, minWidth: 0 }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {categories.map((cat) => {
                        const isActive = cat === selectedCategory;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    background: isActive ? 'linear-gradient(135deg, #71b3e5, #5a9fd4)' : 'white',
                                    border: isActive ? 'none' : '1px solid #eaedf2',
                                    borderRadius: 10, padding: '8px 16px',
                                    fontFamily: 'Kedebideri, sans-serif', fontWeight: isActive ? 600 : 400,
                                    fontSize: 13, color: isActive ? 'white' : '#555', cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                            >
                                {cat}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)',
                            border: 'none', borderRadius: 10, padding: '8px 16px',
                            fontFamily: 'Kedebideri, sans-serif', fontWeight: 600, fontSize: 13,
                            color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                    >
                        {uploading ? '업로드 중...' : '+ 아이템 추가'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <p style={{ fontFamily: 'Kedebideri, sans-serif', color: '#aaa', fontSize: 14 }}>불러오는 중...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 20, padding: '60px', textAlign: 'center', border: '1px solid #eaedf2' }}>
                    <p style={{ fontSize: 48, margin: '0 0 12px' }}>👗</p>
                    <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 16, color: '#1a1a2e', margin: '0 0 8px' }}>
                        {selectedCategory === '전체' ? '옷장이 비어있어요' : `${selectedCategory} 카테고리에 아이템이 없어요`}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#aaa', margin: 0 }}>
                        위 버튼으로 아이템을 추가해보세요
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
                    {filteredItems.map(item => (
                        <div
                            data-scroll-card
                            key={item.id}
                            style={{ background: 'white', border: '1px solid #eaedf2', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
                            onClick={() => openPopup(item)}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                (e.currentTarget as HTMLElement).style.transform = 'none';
                            }}
                        >
                            {item.imageUrl ? (
                                <DaltonizedImage
                                    src={item.imageUrl}
                                    alt={item.type || ''}
                                    colorType={colorType || 'normal'}
                                    correctionEnabled={correctionEnabled}
                                    imgStyle={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                                />
                            ) : (
                                <div style={{ height: 140, background: getColorHex(item.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>
                                    👗
                                </div>
                            )}
                            <div style={{ padding: '12px 14px' }}>
                                <p style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: 0 }}>
                                    {item.type || '아이템'}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                    <span style={{ background: 'rgba(113,179,229,0.12)', borderRadius: 8, padding: '2px 8px', fontFamily: 'Kedebideri, sans-serif', fontWeight: 400, fontSize: 10, color: '#71b3e5' }}>
                                        {normalizeCategory(item.category)}
                                    </span>
                                    {item.color && (
                                        <span style={{ background: 'rgba(113,179,229,0.12)', borderRadius: 8, padding: '2px 8px', fontFamily: 'Kedebideri, sans-serif', fontWeight: 400, fontSize: 10, color: '#71b3e5' }}>
                                            {item.color}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Item Detail Popup */}
            {selectedItem && (
                <>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 }}
                        onClick={() => { setSelectedItem(null); setEditMode(false); }} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', borderRadius: 24, width: 380, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 0', marginBottom: 16 }}>
                            <h2 style={{ fontFamily: 'Hahmlet, sans-serif', fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: 0 }}>옷 상세 정보</h2>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {!editMode ? (
                                    <button onClick={() => setEditMode(true)} style={{ padding: '6px 14px', background: 'rgba(113,179,229,0.12)', color: '#71b3e5', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontWeight: 500 }}>수정</button>
                                ) : (
                                    <>
                                        <button onClick={handleEdit} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #71b3e5, #5a9fd4)', color: 'white', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontWeight: 600 }}>저장</button>
                                        <button onClick={() => setEditMode(false)} style={{ padding: '6px 14px', background: '#f5f7fa', color: '#888', border: 'none', borderRadius: 999, fontSize: 13, cursor: 'pointer' }}>취소</button>
                                    </>
                                )}
                                <button onClick={() => { setSelectedItem(null); setEditMode(false); }} style={{ background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer' }}>✕</button>
                            </div>
                        </div>

                        <div style={{ padding: '0 20px', marginBottom: 16 }}>
                            {selectedItem.imageUrl ? (
                                <DaltonizedImage
                                    src={selectedItem.imageUrl}
                                    alt={selectedItem.type || ''}
                                    colorType={colorType || 'normal'}
                                    correctionEnabled={correctionEnabled}
                                    imgStyle={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 16, display: 'block' }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: 260, background: getColorHex(selectedItem.color), borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
                                    👗
                                </div>
                            )}
                        </div>

                        {!editMode ? (
                            <div style={{ padding: '0 20px', marginBottom: 16 }}>
                                {[
                                    { label: '카테고리', value: normalizeCategory(selectedItem.category) },
                                    { label: '종류', value: selectedItem.type || '-' },
                                    { label: '색상', value: selectedItem.color || '-' },
                                    { label: '소재', value: selectedItem.material || '-' },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <span style={{ width: 70, fontSize: 13, color: '#888', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>{row.label}</span>
                                        <span style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 500, fontFamily: 'Hahmlet, sans-serif' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '0 20px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                                    <span style={{ width: 70, fontSize: 13, color: '#888', flexShrink: 0, paddingTop: 2, fontFamily: 'Inter, sans-serif' }}>카테고리</span>
                                    <select style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, background: 'white' }} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                                    <span style={{ width: 70, fontSize: 13, color: '#888', flexShrink: 0, paddingTop: 2, fontFamily: 'Inter, sans-serif' }}>종류</span>
                                    <input style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, boxSizing: 'border-box' }} value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} placeholder="예: 티셔츠, 청바지" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                                    <span style={{ width: 70, fontSize: 13, color: '#888', flexShrink: 0, paddingTop: 2, fontFamily: 'Inter, sans-serif' }}>색상</span>
                                    <div style={{ flex: 1 }}>
                                        <select style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, background: 'white', marginBottom: 6 }} value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })}>
                                            <option value="">선택</option>
                                            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <input style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, boxSizing: 'border-box' }} value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} placeholder="직접 입력" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '11px 0', gap: 12 }}>
                                    <span style={{ width: 70, fontSize: 13, color: '#888', flexShrink: 0, paddingTop: 2, fontFamily: 'Inter, sans-serif' }}>소재</span>
                                    <select style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid #eaedf2', fontSize: 14, background: 'white' }} value={editForm.material} onChange={e => setEditForm({ ...editForm, material: e.target.value })}>
                                        <option value="">선택</option>
                                        {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handleDelete(selectedItem.id)}
                            style={{ width: 'calc(100% - 40px)', margin: '0 20px 20px', padding: 12, background: 'white', color: '#FF5A5A', border: '1px solid #FF5A5A', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontFamily: 'Kedebideri, sans-serif', fontWeight: 500 }}
                        >
                            옷장에서 삭제
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default Wardrobe;
