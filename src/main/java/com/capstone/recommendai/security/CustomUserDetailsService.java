package com.capstone.recommendai.security;

import com.capstone.recommendai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String userId)
            throws UsernameNotFoundException {
        return userRepository.findByUserId(userId)
                .map(user -> org.springframework.security.core.userdetails.User
                        .withUsername(user.getUserId())
                        .password(user.getPassword())
                        .authorities("ROLE_USER")
                        .build())
                .orElseThrow(() ->
                        new UsernameNotFoundException("사용자 없음: " + userId));
    }
}