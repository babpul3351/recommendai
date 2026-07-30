// src/utils/daltonization.js
// Python 서버와 동일한 LMS 변환 행렬 사용
//
// 변경 사항 (기존 대비)
// ------------------
// getDaltonizedImageUrl()에 캐싱을 추가했습니다.
// 같은 이미지(imageUrl) + 같은 색각 유형(colorType) 조합은
// 이미 한 번 보정한 적이 있으면 서버에 다시 요청하지 않고
// 캐시된 결과를 즉시 반환합니다.
//
// 캐시는 메모리(Map)에 저장되므로 브라우저 탭을 새로고침하면 사라집니다.
// 같은 세션 안에서 옷장 화면을 여러 번 드나들 때 속도를 크게 개선합니다.

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
 * (변경 없음 — 현재 코드베이스에서 실제로 호출되는 곳은 없어 보이지만,
 *  기존 함수를 그대로 유지합니다.)
 */
export function applyDaltonization(imageData, colorType) {
    const matrix = MATRICES[colorType];
    if (!matrix) return imageData;

    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]     / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const rLin = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        const gLin = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        const bLin = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

        const rNew = matrix[0][0] * rLin + matrix[0][1] * gLin + matrix[0][2] * bLin;
        const gNew = matrix[1][0] * rLin + matrix[1][1] * gLin + matrix[1][2] * bLin;
        const bNew = matrix[2][0] * rLin + matrix[2][1] * gLin + matrix[2][2] * bLin;

        const toSRGB = (c) => {
            const clamped = Math.max(0, Math.min(1, c));
            return clamped <= 0.0031308
                ? clamped * 12.92
                : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
        };

        data[i]     = Math.round(toSRGB(rNew) * 255);
        data[i + 1] = Math.round(toSRGB(gNew) * 255);
        data[i + 2] = Math.round(toSRGB(bNew) * 255);
    }

    return new ImageData(data, imageData.width, imageData.height);
}

// ─────────────────────────────────────────────
// [신규] 보정 결과 캐시
// key: `${imageUrl}::${colorType}` → value: Blob URL
// ─────────────────────────────────────────────
const daltonizeCache = new Map();

/**
 * 캐시를 비웁니다. (필요 시 다른 컴포넌트에서 호출 가능하도록 export)
 * 예: 로그아웃 시, 또는 색각 유형이 바뀌었을 때 등.
 */
export function clearDaltonizationCache() {
    // 메모리 누수 방지를 위해 기존에 만들어둔 Blob URL도 함께 해제
    for (const url of daltonizeCache.values()) {
        URL.revokeObjectURL(url);
    }
    daltonizeCache.clear();
}

/**
 * 이미지 URL → 백엔드 Daltonization API → 보정된 Blob URL
 * 마이페이지와 동일한 Python 서버 알고리즘 사용
 *
 * 같은 (imageUrl, colorType) 조합으로 이미 요청한 적이 있으면
 * 서버 재요청 없이 캐시된 결과를 즉시 반환합니다.
 */
export async function getDaltonizedImageUrl(imageUrl, colorType) {
    const cacheKey = `${imageUrl}::${colorType}`;

    // 캐시 히트 — 서버 요청 없이 바로 반환
    if (daltonizeCache.has(cacheKey)) {
        return daltonizeCache.get(cacheKey);
    }

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
        reader.onloadend = () => resolve(reader.result);
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
    const correctedBase64 = result.corrected;
    const base64Data = correctedBase64.includes(',')
        ? correctedBase64.split(',')[1]
        : correctedBase64;

    const byteString = atob(base64Data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }
    const correctedBlob = new Blob([byteArray], { type: 'image/jpeg' });
    const objectUrl = URL.createObjectURL(correctedBlob);

    // 캐시에 저장 — 다음 요청부터는 서버를 다시 타지 않음
    daltonizeCache.set(cacheKey, objectUrl);

    return objectUrl;
}