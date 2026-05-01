package com.capstone.recommendai.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;

@Getter
public class SignupRequest {

    @Email(message = "이메일 형식이 아닙니다")
    @NotBlank(message = "이메일을 입력해주세요")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요")
    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다")
    private String password;

    private String nickname;
    private String ageGroup;
    private String gender;
    private String style;
}