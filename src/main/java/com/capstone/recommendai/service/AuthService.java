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

        List<Style> styles = req.getStyles().stream()
                .map(code -> styleRepository.findById(code)
                        .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 스타일: " + code)))
                .collect(Collectors.toList());

        User user = User.builder()
                .ageGroup(req.getAgeGroup())
                .gender(req.getGender())
                .password(passwordEncoder.encode(req.getPassword()))
                .colorType(req.getColorType())
                .build();

        userRepository.save(user);

        styles.forEach(style -> {
            UserStyle userStyle = UserStyle.builder()
                    .user(user)
                    .style(style)
                    .build();
            userStyleRepository.save(userStyle);
        });

        List<String> styleCodes = styles.stream()
                .map(Style::getStyleCode)
                .collect(Collectors.toList());

        String token = jwtUtil.generateToken(user.getUserId());
        return new AuthResponse(token, user.getUserId(),
                user.getAgeGroup(), user.getGender(), styleCodes);
    }

    public AuthResponse login(LoginRequest req) {

        User user = userRepository.findByUserId(req.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다");
        }

        List<String> styleCodes = userStyleRepository.findByUser(user).stream()
                .map(us -> us.getStyle().getStyleCode())
                .collect(Collectors.toList());

        String token = jwtUtil.generateToken(user.getUserId());
        return new AuthResponse(token, user.getUserId(),
                user.getAgeGroup(), user.getGender(), styleCodes);
    }
}