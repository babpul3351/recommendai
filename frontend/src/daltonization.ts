import api, { colorAssistantAPI } from './api/api';

export type ColorType = 'protanopia' | 'deuteranopia' | 'tritanopia';

const MATRICES: Record<ColorType, number[][]> = {
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

export function applyDaltonization(imageData: ImageData, colorType: ColorType): ImageData {
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

        const toSRGB = (c: number): number => {
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

export async function getDaltonizedImageUrl(imageUrl: string, colorType: ColorType): Promise<string> {
    const proxyUrl = `/wardrobe/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    const imageResponse = await api.get(proxyUrl, { responseType: 'blob' });

    const blob: Blob = imageResponse.data;
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const daltonizeResponse = await colorAssistantAPI.daltonize(base64, colorType);
    const result = daltonizeResponse.data;

    const correctedBase64: string = result.corrected;
    const base64Data = correctedBase64.includes(',')
        ? correctedBase64.split(',')[1]
        : correctedBase64;

    const byteString = atob(base64Data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }
    const correctedBlob = new Blob([byteArray], { type: 'image/jpeg' });
    return URL.createObjectURL(correctedBlob);
}