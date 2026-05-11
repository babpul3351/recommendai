import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import Recommend from './pages/Recommend';
import Calendar from './pages/Calendar';
import MyPage from './pages/MyPage';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={
            <PrivateRoute><Home /></PrivateRoute>
          } />
          <Route path="/wardrobe" element={
            <PrivateRoute><Wardrobe /></PrivateRoute>
          } />
          <Route path="/recommend" element={
            <PrivateRoute><Recommend /></PrivateRoute>
          } />
          <Route path="/calendar" element={
            <PrivateRoute><Calendar /></PrivateRoute>
          } />
          <Route path="/mypage" element={
            <PrivateRoute><MyPage /></PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
  );
}

export default App;