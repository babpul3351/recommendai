export interface Weather {
    temp: number;
    desc: string;
    feelsLike?: number;
}

export interface CalendarEvent {
    eventId: number;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}

export interface OutfitItem {
    type?: string;
    color?: string;
}

export interface Outfit {
    top?: OutfitItem;
    bottom?: OutfitItem;
    outer?: OutfitItem;
    style?: string;
    description?: string;
}

export interface MatchedItem {
    id?: string;
    imageUrl?: string;
    imageB64?: string;
    type?: string;
    category?: string;
}

export interface PoolEntry {
    outfit: Outfit;
    matchedItems: MatchedItem[];
    recId: number;
    outfitIndex: number;
}

export interface HistoryItem {
    id?: number;
    imageUrl?: string;
    type?: string;
    category?: string;
}

export interface OutfitInfoH {
    style?: string;
    description?: string;
}

export interface HistoryRecord {
    recId: number;
    tpo: string;
    retryCount?: number;
    createdAt: string;
    outfitDate?: string;
    temperature?: number;
    weatherCondition?: string;
    description?: string;
    allOutfitGroups?: Record<string, HistoryItem[]>;
    outfitInfos?: Record<number, OutfitInfoH>;
    acceptedOutfitIndex?: number;
}
