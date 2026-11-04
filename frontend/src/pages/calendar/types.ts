export interface CalendarEvent {
    eventId: string;
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
}

export interface Outfit {
    outfitDate: string;
    style?: string;
    description?: string;
    matchedItems?: { imageUrl?: string }[];
    compositeImageUrl?: string | null;
    compositeStatus?: string | null;
}

export interface EventForm {
    eventName: string;
    eventDatetime: string;
    tpoKeyword: string;
    allDay?: boolean;
    selectedOutfit?: { imageUrl: string; tpo?: string } | null;
}
