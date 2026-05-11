import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import { wardrobeAPI } from '../api/api';

function Wardrobe() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('전체');
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
                const base64 = reader.result;
                await wardrobeAPI.uploadItem(base64);
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
        } catch (err) {
            alert('삭제 실패');
        }
    };

    const filteredItems = selectedCategory === '전체'
        ? items
        : items.filter(item => item.category === selectedCategory);

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>내 옷장</h1>
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
                                backgroundColor: selectedCategory === cat ? '#333' : '#f0f0f0',
                                color: selectedCategory === cat ? 'white' : '#333'
                            }}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* 옷장 아이템 */}
                {loading ? (
                    <p style={styles.emptyText}>불러오는 중...</p>
                ) : filteredItems.length === 0 ? (
                    <div style={styles.emptyBox}>
                        <p style={styles.emptyText}>
                            {selectedCategory === '전체'
                                ? '옷장이 비어있습니다. 옷을 추가해보세요!'
                                : `${selectedCategory} 카테고리에 옷이 없습니다.`}
                        </p>
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {filteredItems.map(item => (
                            <div key={item.id} style={styles.card}>
                                {item.imageB64 ? (
                                    <img
                                        src={item.imageB64}
                                        alt={item.type}
                                        style={styles.image}
                                    />
                                ) : (
                                    <div style={styles.imagePlaceholder}>
                                        <p style={{ color: '#ccc' }}>이미지 없음</p>
                                    </div>
                                )}
                                <div style={styles.cardInfo}>
                                    <p style={styles.cardCategory}>{item.category}</p>
                                    <p style={styles.cardType}>{item.type}</p>
                                    <p style={styles.cardColor}>{item.color}</p>
                                    {item.material && (
                                        <p style={styles.cardMaterial}>{item.material}</p>
                                    )}
                                </div>
                                <button
                                    style={styles.deleteBtn}
                                    onClick={() => handleDelete(item.id)}
                                >
                                    삭제
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: { backgroundColor: '#f5f5f5', minHeight: '100vh' },
    container: { maxWidth: '1000px', margin: '0 auto', padding: '32px 16px' },
    header: {
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px'
    },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#333', margin: 0 },
    uploadBtn: {
        padding: '10px 20px', backgroundColor: '#333', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '14px',
        cursor: 'pointer', fontWeight: '500'
    },
    filterRow: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' },
    filterBtn: {
        padding: '8px 16px', border: 'none', borderRadius: '20px',
        fontSize: '13px', cursor: 'pointer', fontWeight: '500'
    },
    emptyBox: {
        backgroundColor: 'white', borderRadius: '16px',
        padding: '60px', textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    emptyText: { color: '#888', fontSize: '15px' },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px'
    },
    card: {
        backgroundColor: 'white', borderRadius: '12px',
        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    image: { width: '100%', height: '200px', objectFit: 'cover' },
    imagePlaceholder: {
        width: '100%', height: '200px', backgroundColor: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { padding: '12px' },
    cardCategory: { fontSize: '11px', color: '#888', margin: '0 0 4px' },
    cardType: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: '0 0 4px' },
    cardColor: { fontSize: '13px', color: '#666', margin: '0 0 2px' },
    cardMaterial: { fontSize: '12px', color: '#999', margin: 0 },
    deleteBtn: {
        width: '100%', padding: '8px', backgroundColor: '#fff',
        color: '#e74c3c', border: 'none', borderTop: '1px solid #f0f0f0',
        fontSize: '13px', cursor: 'pointer'
    }
};

export default Wardrobe;