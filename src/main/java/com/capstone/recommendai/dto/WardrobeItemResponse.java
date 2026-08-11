package com.capstone.recommendai.dto;

import com.capstone.recommendai.entity.WardrobeItem;
import lombok.Getter;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Getter
public class WardrobeItemResponse {

    private String id;

    private String category;

    private String type;

    private String color;

    private String material;

    private List<String> styleTags;

    private String imageUrl;


    public WardrobeItemResponse(WardrobeItem item) {

        this.id = item.getItemId();

        this.category = item.getCategory();

        this.type = item.getItemType();

        this.color = item.getColor();

        this.material = item.getMaterial();

        this.styleTags = parseStyleTags(
                item.getStyleTags()
        );

        this.imageUrl = item.getImageThumbnail();
    }


    private List<String> parseStyleTags(String value) {

        if (value == null || value.isBlank()) {
            return Collections.emptyList();
        }

        return Arrays.stream(
                        value.split(",")
                )
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}