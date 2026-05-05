package com.capstone.recommendai.dto;

import com.capstone.recommendai.entity.WardrobeItem;
import lombok.Getter;

@Getter
public class WardrobeItemResponse {
    private String id;
    private String category;
    private String type;
    private String color;
    private String material;
    private String imageB64;

    public WardrobeItemResponse(WardrobeItem item) {
        this.id       = item.getItemId();
        this.category = item.getCategory();
        this.type     = item.getItemType();
        this.color    = item.getColor();
        this.material = item.getMaterial();
        this.imageB64 = item.getImageThumbnail();
    }
}