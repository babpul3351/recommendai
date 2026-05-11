package com.capstone.recommendai.service;

import com.capstone.recommendai.dto.AuthResponse;
import com.capstone.recommendai.dto.LoginRequest;
import com.capstone.recommendai.dto.SignupRequest;
import com.capstone.recommendai.entity.Style;
import com.capstone.recommendai.entity.User;
import com.capstone.recommendai.entity.UserStyle;
import com.capstone.recommendai.repository.StyleRepository;
import com.capstone.recommendai.repository.UserRepository;
import com.capstone.recommendai.repository.UserStyleRepository;
import com.capstone.recommendai.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final StyleRepository styleRepository;
    private final UserStyleRepository userStyleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        // 아이디 중복 확인
        if (userRepository.findByLoginId(req.getLoginId()).isPresent()) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }

        User user = User.builder()
                .loginId(req.getLoginId())
                .nickname(req.getNickname())
                .ageGroup(req.getAgeGroup())
                .gender(req.getGender())
                .password(passwordEncoder.encode(req.getPassword()))
                .build();

        userRepository.save(user);

        // 스타일 저장
        for (String styleCode : req.getStyles()) {
            Style style = styleRepository.findById(styleCode)
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 스타일: " + styleCode));
            UserStyle userStyle = new UserStyle();
            userStyle.setUser(user);
            userStyle.setStyle(style);
            userStyleRepository.save(userStyle);
        }

        String token = jwtUtil.generateToken(user.getUserId());
        List<String> styles = req.getStyles();

        return new AuthResponse(token, user.getUserId(), user.getLoginId(),
                user.getNickname(), user.getAgeGroup(), user.getGender(), styles);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByLoginId(req.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이디입니다."));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }

        String token = jwtUtil.generateToken(user.getUserId());
        List<String> styles = userStyleRepository.findByUser(user)
                .stream().map(us -> us.getStyle().getStyleCode())
                .collect(Collectors.toList());

        return new AuthResponse(token, user.getUserId(), user.getLoginId(),
                user.getNickname(), user.getAgeGroup(), user.getGender(), styles);
    }
}