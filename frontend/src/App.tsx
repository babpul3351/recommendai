import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import Recommend from './pages/Recommend';
import Calendar from './pages/calendar/Page';
import MyPage from './pages/MyPage';
import Navbar from './components/Navbar';
import api from './api/api';

function AuthLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }
        api.get('/user/profile').catch((err) => {
            if (err.response?.status === 401 || err.response?.status === 403) {
                localStorage.clear();
                navigate('/login', { replace: true });
            }
        });
    }, [navigate]);

    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;

    if (isHome) {
        return (
            <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <Outlet />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
            <Navbar />
            <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
                <Outlet />
            </main>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route element={<AuthLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/wardrobe" element={<Wardrobe />} />
                    <Route path="/recommend" element={<Recommend />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/mypage" element={<MyPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
