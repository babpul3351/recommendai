import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav style={styles.nav}>
            <div style={styles.logo} onClick={() => navigate('/')}>
                Look at Life
            </div>
            <div style={styles.menu}>
                <span
                    style={{ ...styles.item, ...(isActive('/') ? styles.active : {}) }}
                    onClick={() => navigate('/')}
                >
                    홈
                </span>
                <span
                    style={{ ...styles.item, ...(isActive('/wardrobe') ? styles.active : {}) }}
                    onClick={() => navigate('/wardrobe')}
                >
                    옷장
                </span>
                <span
                    style={{ ...styles.item, ...(isActive('/recommend') ? styles.active : {}) }}
                    onClick={() => navigate('/recommend')}
                >
                    코디 추천
                </span>
                <span
                    style={{ ...styles.item, ...(isActive('/calendar') ? styles.active : {}) }}
                    onClick={() => navigate('/calendar')}
                >
                    캘린더
                </span>
                <span style={{ ...styles.item, color: '#e74c3c' }} onClick={handleLogout}>
                    로그아웃
                </span>
            </div>
        </nav>
    );
}

const styles = {
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100
    },
    logo: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#333',
        cursor: 'pointer'
    },
    menu: {
        display: 'flex',
        gap: '32px',
        alignItems: 'center'
    },
    item: {
        fontSize: '15px',
        color: '#666',
        cursor: 'pointer',
        fontWeight: '500'
    },
    active: {
        color: '#333',
        borderBottom: '2px solid #333',
        paddingBottom: '2px'
    }
};

export default Navbar;