// src/utils/daltonization.js
// Python 서버와 동일한 LMS 변환 행렬 사용

const MATRICES = {
    protanopia: [
        [0.152286, 1.052583, -0.204868],
        [0.114503, 0.786281,  0.099216],
        [-0.003882, -0.048116, 1.051998]
    ],
    deuteranopia: [
        [0.367322,  0.860646, -0.227968],
        [0.280085,  0.672501,  0.047413],
        [-0.011820,  0.042940,  0.968881]
    ],
    tritanopia: [
        [1.255528, -0.076749, -0.178779],
        [-0.078411,  0.930809,  0.147602],
        [0.004733,  0.691367,  0.303900]
    ]
};

/**
 * ImageData에 Daltonization 보정 적용
 * @param {ImageData} imageData - Canvas에서 추출한 픽셀 데이터
 * @param {string} colorType - 'protanopia' | 'deuteranopia' | 'tritanopia'
 * @returns {ImageData} - 보정된 픽셀 데이터
 */
export function applyDaltonization(imageData, colorType) {
    const matrix = MATRICES[colorType];
    if (!matrix) return imageData;

    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]     / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        // 선형 RGB 변환 (감마 보정)
        const rLin = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        const gLin = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        const bLin = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

        // 행렬 변환
        const rNew = matrix[0][0] * rLin + matrix[0][1] * gLin + matrix[0][2] * bLin;
        const gNew = matrix[1][0] * rLin + matrix[1][1] * gLin + matrix[1][2] * bLin;
        const bNew = matrix[2][0] * rLin + matrix[2][1] * gLin + matrix[2][2] * bLin;

        // 감마 복원
        const toSRGB = (c) => {
            const clamped = Math.max(0, Math.min(1, c));
            return clamped <= 0.0031308
                ? clamped * 12.92
                : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
        };

        data[i]     = Math.round(toSRGB(rNew) * 255);
        data[i + 1] = Math.round(toSRGB(gNew) * 255);
        data[i + 2] = Math.round(toSRGB(bNew) * 255);
        // alpha(data[i+3])는 그대로
    }

    return new ImageData(data, imageData.width, imageData.height);
}

/**
 * 이미지 URL → 보정된 Blob URL 변환
 * @param {string} imageUrl - 원본 이미지 URL (S3 URL)
 * @param {string} colorType - 색각 유형
 * @returns {Promise<string>} - 보정된 이미지의 Blob URL
 */
/**
 * 이미지 URL → 백엔드 Daltonization API → 보정된 Blob URL
 * 마이페이지와 동일한 Python 서버 알고리즘 사용
 */
export async function getDaltonizedImageUrl(imageUrl, colorType) {
    const token = localStorage.getItem('token');

    // 1단계: Spring Boot 프록시로 S3 이미지 가져오기 (CORS 우회)
    const proxyUrl = `http://localhost:8080/api/wardrobe/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    const imageResponse = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!imageResponse.ok) throw new Error('이미지 불러오기 실패');

    // 2단계: blob → base64 변환
    const blob = await imageResponse.blob();
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // data:image/jpeg;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    // 3단계: 마이페이지와 동일한 엔드포인트 호출
    const daltonizeResponse = await fetch('http://localhost:8080/api/user/color-assistant/daltonize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageB64: base64, colorType })
    });
    if (!daltonizeResponse.ok) throw new Error('보정 실패');

    const result = await daltonizeResponse.json();

    // 4단계: corrected base64 → Blob URL
    const correctedBase64 = result.corrected; // Python 서버 반환값
    const base64Data = correctedBase64.includes(',')
        ? correctedBase64.split(',')[1]  // data:image/...;base64, 접두어 제거
        : correctedBase64;

    const byteString = atob(base64Data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }
    const correctedBlob = new Blob([byteArray], { type: 'image/jpeg' });
    return URL.createObjectURL(correctedBlob);
}