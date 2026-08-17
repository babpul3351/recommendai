import React, { useState } from 'react';
import Clothes from './Clothes';
import Outfits from './Outfits';

type Tab = 'clothes' | 'outfits';

function WardrobePage() {
    const [activeTab, setActiveTab] = useState<Tab>('clothes');

    return (
        <div style={{ padding: '70px 36px', maxWidth: 1200, width: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontWeight: 700, fontSize: 28, color: '#1a1a2e', margin: 0 }}>내 옷장</h1>
                <p style={{ fontSize: 14, color: '#888', margin: '6px 0 0' }}>나만의 패션 아카이브를 관리하세요</p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f0f2f5', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {([
                    { id: 'clothes', label: '내 옷' },
                    { id: 'outfits', label: '내 코디' },
                ] as { id: Tab; label: string }[]).map(({ id, label }) => {
                    const active = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            style={{
                                background: active ? 'white' : 'transparent',
                                border: 'none',
                                borderRadius: 9,
                                padding: '8px 24px',
                                fontWeight: active ? 600 : 400,
                                fontSize: 14,
                                color: active ? '#1a1a2e' : '#888',
                                cursor: 'pointer',
                                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {activeTab === 'clothes' ? <Clothes /> : <Outfits />}
        </div>
    );
}

export default WardrobePage;
