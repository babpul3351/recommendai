package com.capstone.recommendai.dto;

import lombok.Getter;

@Getter
public class WardrobeAddRequest {
    private String image;     // base64 이미지 (프론트에서 전송)
    private String filename;
}