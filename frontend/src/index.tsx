import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

if (!process.env.REACT_APP_API_URL) {
  throw new Error('REACT_APP_API_URL이 설정되지 않았습니다.');
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root 엘리먼트를 찾을 수 없습니다.');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();