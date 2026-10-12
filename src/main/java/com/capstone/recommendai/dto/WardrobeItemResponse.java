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
    private String season;     // [신규] 사용자가 지정한 계절 (없으면 null)
    private String imageUrl;   // S3로 저장 방식 변경하였으므로 imageB64 → imageUrl로 변경

    public WardrobeItemResponse(WardrobeItem item) {
        this.id = item.getItemId();
        this.category = item.getCategory();
        this.type = item.getItemType();
        this.color = item.getColor();
        this.material = item.getMaterial();
        this.season = item.getSeason();
        this.imageUrl = item.getImageThumbnail();  // S3 URL
    }
}