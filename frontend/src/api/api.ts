import axios, { AxiosResponse } from 'axios';
import { BASE_URL } from './env';

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
    (response: AxiosResponse) => response,
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
    signup: (data: object) => api.post('/auth/signup', data),
    login: (data: object) => api.post('/auth/login', data)
};

export const calendarAPI = {
    getEvents: () => api.get('/calendar'),
    addEvent: (data: object) => api.post('/calendar', data),
    deleteEvent: (eventId: number) => api.delete(`/calendar/${eventId}`)
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: object) => api.put('/user/profile', data)
};

export const recommendationAPI = {
    getHistory: () => api.get('/recommendations'),
    getWeekOutfits: (start: string, end: string) => api.get(`/recommendations/week?start=${start}&end=${end}`),
    acceptOutfit: (recId: number, data: object) => api.put(`/recommendations/${recId}/accept`, data),
};

export const colorAssistantAPI = {
    daltonize: (imageB64: string, colorType: string) =>
        api.post('/user/color-assistant/daltonize', { imageB64, colorType }),
    updateColorType: (colorType: string) =>
        api.put('/user/color-type', { colorType })
};

export const weatherAPI = {
    getWeather: () => api.get('/weather'),
    getForecast: (date: string) => api.get(`/weather/forecast?date=${date}`)
};

export const wardrobeAPI = {
    getWardrobe: () => api.get('/wardrobe'),
    uploadItem: (imageB64: string) => api.post('/wardrobe/upload', { imageB64 }),
    deleteItem: (itemId: number) => api.delete(`/wardrobe/${itemId}`),
    updateItem: (itemId: number, data: object) => api.put(`/wardrobe/${itemId}`, data),
    recommend: (data: object) => api.post('/wardrobe/recommend', data)
};

export default api;