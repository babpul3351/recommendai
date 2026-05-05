package com.capstone.recommendai.dto;

import com.capstone.recommendai.entity.Recommendation;
import com.capstone.recommendai.entity.RecommendationItem;
import lombok.Getter;
import java.util.List;
import java.util.stream.Collectors;

@Getter
public class RecommendationResponse {
    private String recId;
    private String tpo;
    private String style;
    private String description;
    private Integer temperature;
    private String weatherCondition;
    private String createdAt;
    private List<ItemDetail> items;

    public RecommendationResponse(Recommendation rec) {
        this.recId            = rec.getRecId();
        this.tpo              = rec.getTpo();
        this.style            = rec.getStyle();
        this.description      = rec.getDescription();
        this.temperature      = rec.getTemperature();
        this.weatherCondition = rec.getWeatherCondition();
        this.createdAt        = rec.getCreatedAt().toString();
        this.items            = rec.getItems().stream()
                .map(ItemDetail::new)
                .collect(Collectors.toList());
    }

    @Getter
    public static class ItemDetail {
        private Integer orderNum;
        private String category;
        private String wardrobeItemId;
        private String color;
        private String itemType;
        private String imageThumbnail;
        private Float similarityScore;

        public ItemDetail(RecommendationItem item) {
            this.orderNum      = item.getOrderNum();
            this.category      = item.getCategory();
            this.similarityScore = item.getSimilarityScore();

            if (item.getMatchedWardrobeItem() != null) {
                this.wardrobeItemId  = item.getMatchedWardrobeItem().getItemId();
                this.color           = item.getMatchedWardrobeItem().getColor();
                this.itemType        = item.getMatchedWardrobeItem().getItemType();
                this.imageThumbnail  = item.getMatchedWardrobeItem().getImageThumbnail();
            }
        }
    }
}