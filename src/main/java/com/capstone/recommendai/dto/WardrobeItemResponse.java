package com.capstone.recommendai.dto;

import com.capstone.recommendai.entity.WardrobeItem;
import lombok.Getter;

@Getter
public class WardrobeItemResponse {
    private Long id;
    private String category;
    private String type;
    private String color;
    private String material;
    private String imageB64;

    // Entity → DTO 변환
    public WardrobeItemResponse(WardrobeItem item) {
        this.id       = item.getId();
        this.category = item.getCategory();
        this.type     = item.getType();
        this.color    = item.getColor();
        this.material = item.getMaterial();
        this.imageB64 = item.getImageB64();
    }
}