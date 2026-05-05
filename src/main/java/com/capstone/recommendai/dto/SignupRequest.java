package com.capstone.recommendai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import java.util.List;

@Getter
public class SignupRequest {

    @NotBlank(message = "연령대를 입력해주세요")
    private String ageGroup;

    @NotBlank(message = "성별을 입력해주세요")
    private String gender;

    @NotBlank(message = "비밀번호를 입력해주세요")
    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다")
    private String password;

    private String colorType;

    @NotEmpty(message = "스타일을 최소 1개 선택해주세요")
    @Size(max = 3, message = "스타일은 최대 3개까지 선택 가능합니다")
    private List<String> styles;  // style_code 목록 (예: ["casual", "sporty"])
}