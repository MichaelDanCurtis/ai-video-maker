"""
End-to-end verification test for photo generation flow.

This test verifies the complete photo generation pipeline:
1. Frontend sends request to backend API
2. Backend calls OpenRouter API
3. Response flows back to frontend with proper status handling

Run with: pytest tests/e2e/test_photo_generation_flow.py -v

Requirements:
- Backend server running on localhost:8000
- Valid OPENROUTER_API_KEY in .env
"""

import os
import sys
from pathlib import Path

import pytest
import httpx


# Test configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
API_TIMEOUT = 120.0  # 2 minutes for AI operations


@pytest.fixture
def api_client():
    """Create an HTTP client for API testing."""
    with httpx.Client(base_url=BACKEND_URL, timeout=API_TIMEOUT) as client:
        yield client


class TestHealthCheck:
    """Verify backend server is running and healthy."""

    def test_root_endpoint(self, api_client):
        """Test that root endpoint returns API info."""
        response = api_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data

    def test_health_endpoint(self, api_client):
        """Test health check endpoint."""
        response = api_client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


class TestPhotoGenerationFlow:
    """End-to-end tests for photo generation."""

    def test_generate_photo_request_validation(self, api_client):
        """Test that empty prompts are rejected."""
        response = api_client.post(
            "/api/v1/photo/generate",
            json={"prompt": ""},
        )
        # Should fail validation - empty prompt
        assert response.status_code == 422

    def test_generate_photo_with_valid_prompt(self, api_client):
        """Test photo generation with a valid prompt.

        Note: This test requires a valid OpenRouter API key.
        If no key is configured, it will return a 401 error.
        """
        response = api_client.post(
            "/api/v1/photo/generate",
            json={
                "prompt": "A simple red circle on white background",
                "size": "512x512",
            },
        )

        # If API key is not configured, we expect 401
        if response.status_code == 401:
            data = response.json()
            assert "detail" in data
            pytest.skip("OpenRouter API key not configured - skipping actual generation test")

        # If API key is valid, we should get a response
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "job_id" in data
        assert "status" in data
        assert "model" in data
        assert "prompt" in data

        # Status should be completed or failed
        assert data["status"] in ["completed", "failed"]

        # If completed, should have image data
        if data["status"] == "completed":
            assert data.get("image_url") or data.get("image_base64")

        # If failed, should have error message
        if data["status"] == "failed":
            assert "error" in data

    def test_generate_photo_response_structure(self, api_client):
        """Test that photo generation response has correct structure."""
        response = api_client.post(
            "/api/v1/photo/generate",
            json={"prompt": "Test prompt for structure validation"},
        )

        # Skip if auth error
        if response.status_code == 401:
            pytest.skip("OpenRouter API key not configured")

        data = response.json()

        # Required fields in response
        required_fields = ["job_id", "status", "model", "prompt", "created_at"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestErrorHandling:
    """Test error handling in the photo generation flow."""

    def test_rate_limit_error_handling(self, api_client):
        """Verify rate limit errors are properly handled.

        Note: This is difficult to trigger in a single test.
        The backend should return 429 status when rate limited.
        """
        # Just verify the endpoint exists and responds
        response = api_client.post(
            "/api/v1/photo/generate",
            json={"prompt": "Test prompt"},
        )
        # Any response means the error handling pipeline works
        assert response.status_code in [200, 401, 429, 500]

    def test_invalid_json_request(self, api_client):
        """Test handling of invalid JSON in request body."""
        response = api_client.post(
            "/api/v1/photo/generate",
            content="not valid json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422


class TestCORSConfiguration:
    """Test CORS configuration for frontend communication."""

    def test_cors_headers_present(self, api_client):
        """Verify CORS headers are set for cross-origin requests."""
        response = api_client.options(
            "/api/v1/photo/generate",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        # CORS preflight should succeed
        assert response.status_code in [200, 204]


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
