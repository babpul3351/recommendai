import axios, { AxiosResponse } from 'axios';
import { BASE_URL } from './env';

interface SignupData      { loginId: string; nickname: string; ageGroup: string; gender: string; password: string; styles: string[]; }
interface LoginData       { loginId: string; password: string; }
interface AddEventData    { eventName: string; eventDatetime: string; tpoKeyword: string; }
interface UpdateProfileData {
    nickname?: string;
    ageGroup?: string;
    gender?: string;
    colorType?: string;
    styles?: string[];
    correctionEnabled?: boolean;
}
interface AcceptOutfitData  { outfitIndex: number; style: string; description: string; }
interface UpdateItemData  { category?: string; type?: string; color?: string; material?: string; season?: string; }
interface RecommendData {
    tpo: string;
    tpoDetail?: string;
    mode: string;
    linkedEvents?: string[];
    linkedEventIds?: string[];
    outfitDate?: string;
    numOutfits?: number;
    parentRecId?: number | null;
    excludeItemIds?: (string | undefined)[];
}

// [신규] 색상 무드보드 응답 타입 (Spring ColorMoodboardService / AI color_moodboard_service v2 기준)
export interface ColorDescription {
    family: string;         // 예: "갈색 계열"
    lightness: string;      // 밝은 / 중간 밝기 / 어두운
    chroma: string;         // 무채색 / 탁한 / 중간 채도 / 선명한
    temperature: string;    // 따뜻한 느낌 / 차가운 느낌 / 중간 온도 / 온도감 거의 없음
    text: string;           // 위 네 가지를 이은 문장
}
export interface MoodboardPaletteColor {
    index: number;
    hex: string;                  // 실제 색 (사진 픽셀에서 계산)
    correctedHex: string | null;  // 보정 색 (색상 보정 뷰어와 같은 공식). 정상 색각이면 null
    ratio: number;
    name: string;
    feeling: string;              // Gemini 문장 (실패 시 빈 문자열)
    description: ColorDescription;
    isGarment: boolean;
    likelySkin: boolean;
}
export interface MoodboardMood {
    title: string;
    scene: string;
    keywords: string[];
    colors: string[];             // 팔레트의 실제 색 hex
}
export interface PhotoConfusion { a: number; b: number; deltaE: number; seenDeltaE: number; }
interface MatchedItemBase {
    itemId: string;
    deltaE: number;               // 실제 색 차이 (CIEDE2000)
    itemHex: string;
    itemCorrectedHex: string | null;
    itemDescription: string;
    type?: string;
    category?: string;
    color?: string;
    imageUrl?: string;
}
export interface ColorMatchItem extends MatchedItemBase { label: string; }      // "거의 같은 색" | "비슷한 색"
export interface ColorConfusionItem extends MatchedItemBase { seenDeltaE: number; }  // 내 색각 기준 차이
export type ColorFamilyItem = MatchedItemBase;                                        // 같은 색 계열 (색 차이는 큼)
export interface WardrobeColorStatus { total: number; analyzed: number; running: boolean; }
export interface ColorMatchResult {
    baseHex: string;
    baseCorrectedHex: string | null;
    baseDescription: string;
    matches: ColorMatchItem[];
    confusions: ColorConfusionItem[];
    sameFamily: ColorFamilyItem[];
    baseFamily: string;
    eligibleCount: number;
    analyzedCount: number;
    colorDeficient: boolean;
    colorTypeLabel: string;
    thresholds: { same: number; similar: number; confuseReal: number; confuseSeen: number };
    status: WardrobeColorStatus;
}
export interface MoodboardResponse {
    method: 'yolo' | 'center';
    colorType: string;
    colorTypeLabel: string;
    palette: MoodboardPaletteColor[];
    baseIndex: number;
    photoConfusions: PhotoConfusion[];
    garment: string;
    summary: string;
    tip: string;
    moods: MoodboardMood[];
    moodSource: 'gemini' | 'fallback';
    notes: string[];
    match?: ColorMatchResult;
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
        if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
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
    deleteEvent: (eventId: string) => api.delete(`/calendar/${eventId}`)
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: UpdateProfileData) => api.put('/user/profile', data)
};

export const recommendationAPI = {
    getHistory: () => api.get('/recommendations'),
    getWeekOutfits: (start: string, end: string) => api.get(`/recommendations/week?start=${start}&end=${end}`, { skipAuthRedirect: true } as any),
    acceptOutfit: (recId: number, data: AcceptOutfitData) => api.put(`/recommendations/${recId}/accept`, data),
};

export const colorAssistantAPI = {
    daltonize: (imageB64: string, colorType: string) =>
        api.post('/user/color-assistant/daltonize', { imageB64, colorType }),
    // [신규] 업로드 사진의 색 팔레트 + 무드보드 + (가장 큰 옷 색 기준) 옷장 매칭
    moodboard: (imageB64: string) =>
        api.post<MoodboardResponse>('/user/color-assistant/moodboard', { imageB64 }),
    // [신규] 기준 색을 바꿔 옷장에서 다시 찾기
    matchColor: (baseHex: string) =>
        api.post<ColorMatchResult>('/user/color-assistant/match', { baseHex }),
    // [신규] 옷장 색 백그라운드 계산 시작 / 진행 상태
    analyzeWardrobeColors: () =>
        api.post<WardrobeColorStatus>('/user/color-assistant/wardrobe-colors/analyze'),
    wardrobeColorStatus: () =>
        api.get<WardrobeColorStatus>('/user/color-assistant/wardrobe-colors/status'),
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
    updateItem: (itemId: number | string, data: UpdateItemData) => api.put(`/wardrobe/${itemId}`, data),
    recommend: (data: RecommendData) => api.post('/wardrobe/recommend', data)
};

export const idleAPI = {
    getHistory: () => api.get('/idle/history'),
    getItems: () => api.get('/idle/items'),
    decide: (itemId: string, decision: string) => api.post(`/idle/${itemId}/decision`, { decision }),
    resaleDraft: (itemId: string, extra: { brand?: string; size?: string; condition?: string; price?: string }) =>
        api.post(`/idle/${itemId}/resale-draft`, extra),
};

export default api;