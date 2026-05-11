package com.capstone.recommendai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import java.util.Base64;
import java.util.UUID;

@Service
public class S3Service {

    private final S3Client s3Client;
    private final String bucket;
    private final String region;

    public S3Service(
            @Value("${aws.s3.access-key}") String accessKey,
            @Value("${aws.s3.secret-key}") String secretKey,
            @Value("${aws.s3.region}") String region,
            @Value("${aws.s3.bucket}") String bucket) {

        this.bucket = bucket;
        this.region = region;
        this.s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }

    public String uploadBase64Image(String base64Image) {
        try {
            String base64Data = base64Image;
            String contentType = "image/jpeg";

            if (base64Image.contains(",")) {
                String[] parts = base64Image.split(",");
                base64Data = parts[1];
                String header = parts[0];
                if (header.contains("png")) contentType = "image/png";
                else if (header.contains("webp")) contentType = "image/webp";
            }

            byte[] imageBytes = Base64.getDecoder().decode(base64Data);
            String fileName = "wardrobe/" + UUID.randomUUID() + getExtension(contentType);

            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(fileName)
                    .contentType(contentType)
                    .contentLength((long) imageBytes.length)
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(imageBytes));

            return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + fileName;

        } catch (Exception e) {
            throw new RuntimeException("S3 업로드 실패: " + e.getMessage());
        }
    }

    public void deleteImage(String imageUrl) {
        try {
            if (imageUrl == null || !imageUrl.contains("amazonaws.com")) return;
            String key = imageUrl.substring(imageUrl.indexOf("wardrobe/"));
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
        } catch (Exception e) {
            System.err.println("S3 삭제 실패: " + e.getMessage());
        }
    }

    private String getExtension(String contentType) {
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}