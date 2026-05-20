import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import Recommend from './pages/Recommend';
import Calendar from './pages/Calendar';
import MyPage from './pages/MyPage';
import api from './api/api';

function AuthGuard({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    // 토큰 유효성 서버 검증
    api.get('/user/profile').catch((err) => {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.clear();
        navigate('/login', { replace: true });
      }
    });
  }, [navigate]);

  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<AuthGuard><Home /></AuthGuard>} />
          <Route path="/wardrobe" element={<AuthGuard><Wardrobe /></AuthGuard>} />
          <Route path="/recommend" element={<AuthGuard><Recommend /></AuthGuard>} />
          <Route path="/calendar" element={<AuthGuard><Calendar /></AuthGuard>} />
          <Route path="/mypage" element={<AuthGuard><MyPage /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;