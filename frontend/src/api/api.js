import axios from 'axios';

const BASE_URL = 'http://localhost:8080/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authAPI = {
    signup: (data) => api.post('/auth/signup', data),
    login: (data) => api.post('/auth/login', data)
};


export const calendarAPI = {
    getEvents: () => api.get('/calendar'),
    addEvent: (data) => api.post('/calendar', data),
    deleteEvent: (eventId) => api.delete(`/calendar/${eventId}`),
    suggestTpo: (eventName) => api.get('/calendar/suggest-tpo', { params: { eventName } })
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data) => api.put('/user/profile', data)
};

export const recommendationAPI = {
    getHistory: () => api.get('/recommendations'),
    getWeekOutfits: (start, end) => api.get(`/recommendations/week?start=${start}&end=${end}`),
    acceptOutfit: (recId, data) => api.put(`/recommendations/${recId}/accept`, data),  // ← 추가
};

export const colorAssistantAPI = {
    daltonize: (imageB64, colorType) =>
        api.post('/user/color-assistant/daltonize', { imageB64, colorType }),
    updateColorType: (colorType) =>
        api.put('/user/color-type', { colorType })
};

export const weatherAPI = {
    getWeather: () => api.get('/weather'),
    getForecast: (date) => api.get(`/weather/forecast?date=${date}`)
};

export const wardrobeAPI = {
    getWardrobe: () => api.get('/wardrobe'),
    uploadItem: (imageB64) => api.post('/wardrobe/upload', { imageB64 }),
    deleteItem: (itemId) => api.delete(`/wardrobe/${itemId}`),
    updateItem: (itemId, data) => api.put(`/wardrobe/${itemId}`, data),
    recommend: (data) => api.post('/wardrobe/recommend', data)
};

export default api;