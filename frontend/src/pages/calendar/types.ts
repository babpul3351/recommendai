export interface CalendarEvent {
    eventId: number;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}

export interface Outfit {
    outfitDate: string;
    style?: string;
    description?: string;
    matchedItems?: { imageUrl?: string }[];
}

export interface EventForm {
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
    selectedOutfit?: { imageUrl: string; tpo?: string } | null;
}
