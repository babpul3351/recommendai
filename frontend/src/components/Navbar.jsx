import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';

const NAV_ITEMS = [
    { path: '/wardrobe', label: '옷장', icon: WardrobeIcon },
    { path: '/calendar', label: '캘린더', icon: CalendarIcon },
    { path: '/', label: '홈', icon: HomeIcon },
    { path: '/recommend', label: 'AI 추천', icon: RecommendIcon },
    { path: '/mypage', label: '마이', icon: MypageIcon },
];

function WardrobeIcon({ active }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <line x1="12" y1="3" x2="12" y2="21" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <circle cx="9" cy="10" r="1.2" fill={active ? theme.colors.primary : '#888'}/>
            <circle cx="15" cy="10" r="1.2" fill={active ? theme.colors.primary : '#888'}/>
        </svg>
    );
}

function CalendarIcon({ active }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <line x1="8" y1="3" x2="8" y2="7" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="16" y1="3" x2="16" y2="7" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
    );
}

function HomeIcon({ active }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12L12 4L21 12V21H15V15H9V21H3V12Z"
                  stroke={active ? theme.colors.primary : '#888'}
                  strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
    );
}

function RecommendIcon({ active }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <path d="M8 12C8 9.8 9.8 8 12 8C14.2 8 16 9.8 16 12"
                  stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="15" r="1.5" fill={active ? theme.colors.primary : '#888'}/>
        </svg>
    );
}

function MypageIcon({ active }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8"/>
            <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20"
                  stroke={active ? theme.colors.primary : '#888'} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
    );
}

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <>
            {/* 상단 헤더 */}
            <div style={styles.header}>
                <button style={styles.menuBtn}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <line x1="3" y1="6" x2="19" y2="6" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="3" y1="11" x2="19" y2="11" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="3" y1="16" x2="19" y2="16" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                </button>
                <div style={styles.logo}>
                    Look <span style={{ color: theme.colors.primary }}>at</span> Life
                </div>
                <button style={styles.bellBtn}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.7 2 6 4.7 6 8V13L4 15V17H20V15L18 13V8C18 4.7 15.3 2 12 2Z"
                              stroke="#333" strokeWidth="1.8" strokeLinejoin="round"/>
                        <path d="M10 17C10 18.1 10.9 19 12 19C13.1 19 14 18.1 14 17"
                              stroke="#333" strokeWidth="1.8"/>
                    </svg>
                </button>
            </div>

            {/* 하단 탭 바 */}
            <div style={styles.tabBar}>
                {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                    const active = isActive(path);
                    return (
                        <button key={path} style={styles.tabItem} onClick={() => navigate(path)}>
                            <Icon active={active} />
                            <span style={{
                                ...styles.tabLabel,
                                color: active ? theme.colors.primary : '#888',
                                fontWeight: active ? '600' : '400'
                            }}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

const styles = {
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', backgroundColor: theme.colors.white,
        borderBottom: `1px solid ${theme.colors.border}`,
        position: 'sticky', top: 0, zIndex: 100
    },
    menuBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },
    logo: {
        fontSize: '20px', fontWeight: '700', color: '#1A1A1A', letterSpacing: '-0.3px'
    },
    bellBtn: {
        width: '38px', height: '38px', borderRadius: '50%',
        backgroundColor: theme.colors.primaryLight, border: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    tabBar: {
        display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: theme.colors.primaryLight,
        borderTop: `1px solid ${theme.colors.border}`,
        zIndex: 100, padding: '8px 0 16px'
    },
    tabItem: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0'
    },
    tabLabel: { fontSize: '10px' }
};

export default Navbar;