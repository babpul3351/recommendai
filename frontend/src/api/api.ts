import axios, { AxiosResponse } from 'axios';
import { BASE_URL } from './env';

interface SignupData      { loginId: string; nickname: string; ageGroup: string; gender: string; password: string; styles: string[]; }
interface LoginData       { loginId: string; password: string; }
interface AddEventData    { eventName: string; eventDatetime: string; tpoKeyword: string; }
interface UpdateProfileData { nickname: string; ageGroup: string; gender: string; colorType: string; styles: string[]; }
interface AcceptOutfitData  { outfitIndex: number; style: string; description: string; }
interface UpdateItemData  { category: string; type: string; color: string; material: string; }
interface RecommendData {
    tpo: string;
    mode: string;
    linkedEvents?: number[];
    linkedEventIds?: number[];
    outfitDate?: string;
    numOutfits?: number;
    parentRecId?: number | null;
    excludeItemIds?: (string | undefined)[];
}

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
    signup: (data: SignupData) => api.post('/auth/signup', data),
    login:  (data: LoginData)  => api.post('/auth/login', data),
};

export const calendarAPI = {
    getEvents: () => api.get('/calendar'),
    addEvent: (data: AddEventData) => api.post('/calendar', data),
    deleteEvent: (eventId: number) => api.delete(`/calendar/${eventId}`)
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: UpdateProfileData) => api.put('/user/profile', data)
};

export const recommendationAPI = {
    getHistory: () => api.get('/recommendations'),
    getWeekOutfits: (start: string, end: string) => api.get(`/recommendations/week?start=${start}&end=${end}`),
    acceptOutfit: (recId: number, data: AcceptOutfitData) => api.put(`/recommendations/${recId}/accept`, data),
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
    saveOutfit: (imageB64: string, tpo?: string) => api.post('/wardrobe/save-outfit', { imageB64, tpo: tpo || '' }),
    deleteItem: (itemId: number) => api.delete(`/wardrobe/${itemId}`),
    updateItem: (itemId: number, data: UpdateItemData) => api.put(`/wardrobe/${itemId}`, data),
    recommend: (data: RecommendData) => api.post('/wardrobe/recommend', data)
};

export default api;