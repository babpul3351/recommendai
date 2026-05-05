package com.capstone.recommendai.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String userId;
    private String ageGroup;
    private String gender;
    private List<String> styles;
}