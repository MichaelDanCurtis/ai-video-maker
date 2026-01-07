# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AI Video Maker is a full-stack application for AI-powered multimedia creation and editing. It provides a Next.js frontend and FastAPI backend for generating and transforming photos and videos using OpenRouter's AI models.

**Architecture:**
- **Backend**: FastAPI (Python 3.9+) with async support via `httpx`
- **Frontend**: Next.js 14 with TypeScript, React 18, and Tailwind CSS
- **AI Integration**: OpenRouter API for image/video generation
- **Optional**: LangFlow for workflow orchestration (primarily for text/LLM workflows; not recommended for media generation)

## Environment Setup

### Initial Setup
```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env and add your OpenRouter API key (get from https://openrouter.ai/keys)

# 2. Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend
npm install
```

### Required Environment Variables
- `OPENROUTER_API_KEY`: Required for AI operations (from https://openrouter.ai/keys)
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint (default: http://localhost:8000)
- `CORS_ORIGINS`: Allowed frontend origins for CORS (default: http://localhost:3000)

## Development Commands

### Running Services

**Backend (from project root):**
```bash
# Development server with hot reload
cd backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or with Docker Compose (both services)
docker-compose up -d
```

**Frontend (from project root):**
```bash
cd frontend
npm run dev       # Development server (http://localhost:3000)
npm run build     # Production build
npm run start     # Production server
npm run lint      # Next.js linting
```

### Testing

**Backend E2E Tests:**
```bash
cd backend
.venv/bin/pytest tests/e2e/test_photo_generation_flow.py -v

# Run with specific test
.venv/bin/pytest tests/e2e/test_photo_generation_flow.py::TestPhotoGenerationFlow::test_generate_photo_with_valid_prompt -v
```

**Full E2E Verification Script:**
```bash
# Starts both servers and runs end-to-end verification
./scripts/verify_e2e_photo_flow.sh
```

This script verifies:
- Backend health checks
- Frontend server startup
- API endpoint responses
- Photo generation flow (with/without API key)

### API Documentation

With backend running, access:
- Interactive docs: http://localhost:8000/docs (Swagger UI)
- Alternative docs: http://localhost:8000/redoc (ReDoc)
- Root endpoint: http://localhost:8000/ (API info)

## Architecture Details

### Backend Structure

**Core Components:**
- `app/main.py`: FastAPI application entry point with CORS middleware
- `app/config.py`: Settings management via `pydantic-settings` (loads from `.env`)
- `app/models/schemas.py`: Pydantic models for request/response validation
- `app/services/openrouter.py`: OpenRouter API client with context manager support
- `app/services/workflow.py`: Multi-step workflow orchestration (API-based and LangFlow integration)

**API Routers:**
- `app/routers/health.py`: Health check endpoint (`/api/v1/health`)
- `app/routers/photo.py`: Photo generation endpoints (`/api/v1/photo/...`)
- `app/routers/video.py`: Video generation endpoints (`/api/v1/video/...`)
- `app/routers/transform.py`: Photo/video editing and photo-to-video transformation

**Key Patterns:**
- All API routes are prefixed with `/api/v1/`
- Job-based async pattern: endpoints return `job_id` with status (`pending`, `processing`, `completed`, `failed`)
- Custom exception hierarchy: `OpenRouterError` → `OpenRouterAuthError`, `OpenRouterRateLimitError`, `OpenRouterAPIError`
- Context managers for resource cleanup: Use `async with get_openrouter_client_async()` for API calls

### Frontend Structure

**Key Files:**
- `src/app/page.tsx`: Main application page with tab-based UI
- `src/app/layout.tsx`: Root layout and global styles
- `src/lib/api.ts`: Type-safe API client with all backend endpoints
- `src/lib/types.ts`: TypeScript types matching backend schemas

**UI Components:**
- `src/components/PhotoCreator.tsx`: Generate photos from prompts
- `src/components/PhotoEditor.tsx`: Edit existing photos with AI
- `src/components/VideoCreator.tsx`: Generate videos from prompts
- `src/components/VideoEditor.tsx`: Edit existing videos
- `src/components/PhotoToVideo.tsx`: Animate static photos into videos
- `src/components/ui/*`: Reusable UI primitives (Button, Input, Card, ModelSelector, FileUpload, etc.)

**API Client Patterns:**
- Use `api.*` methods from `src/lib/api.ts` for all backend communication
- Multipart form uploads: Use `apiUpload()` internally for file-based endpoints
- Error handling: `ApiException` class with status codes and details
- Job polling: `pollJobStatus()` utility for long-running operations
- Default timeout: 120 seconds (2 minutes) for AI operations

### Data Flow

**Photo Generation Flow:**
1. Frontend: User enters prompt → calls `api.generatePhoto()`
2. Backend: `/api/v1/photo/generate` → `OpenRouterClient.generate_image_async()`
3. OpenRouter: Processes request and returns image URL or base64 data
4. Backend: Returns `PhotoGenerationResponse` with `job_id` and status
5. Frontend: Displays result or error

**File Upload Flow (Edit/Transform):**
1. Frontend: User uploads file + edit params → calls `api.editPhoto()` or similar
2. Backend: Receives multipart form data → validates file type/size
3. Processing: Transforms image/video using AI model
4. Backend: Returns response with edited media URL or base64 data

## Docker Support

**Services:**
- `frontend`: Next.js app on port 3000
- `backend`: FastAPI app on port 8000
- `langflow`: (Optional) LangFlow on port 7860 - uncomment in `docker-compose.yml` to enable

**Docker Commands:**
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f backend    # View backend logs
docker-compose logs -f frontend   # View frontend logs
docker-compose restart backend    # Restart backend
```

## Development Guidelines

### Working with OpenRouter Client

**Always use context managers:**
```python
# Async (preferred in FastAPI)
async with get_openrouter_client_async() as client:
    result = await client.generate_image_async(prompt="...")

# Sync (if needed)
with get_openrouter_client() as client:
    result = client.generate_image(prompt="...")
```

**Error Handling:**
- Catch specific exceptions: `OpenRouterAuthError` (401), `OpenRouterRateLimitError` (429), `OpenRouterAPIError` (general)
- Convert to appropriate HTTP exceptions in routers
- Return failed job status for recoverable API errors instead of raising 500 errors

### Adding New Endpoints

1. Define Pydantic schemas in `app/models/schemas.py`
2. Create router in `app/routers/` with appropriate prefix
3. Register router in `app/main.py` using `app.include_router()`
4. Add corresponding TypeScript types in `frontend/src/lib/types.ts`
5. Add API client methods in `frontend/src/lib/api.ts`
6. Update OpenAPI docs will auto-generate at `/docs`

### Frontend API Integration

**Example: Adding new photo generation call**
```typescript
import { api } from '@/lib/api';

try {
  const response = await api.generatePhoto({
    prompt: "A beautiful sunset",
    size: "1024x1024"
  });
  
  if (response.status === 'completed') {
    // Display image from response.image_url or response.image_base64
  }
} catch (error) {
  const message = api.getErrorMessage(error);
  // Display error to user
}
```

### Adding Workflow Steps

For multi-step AI pipelines, extend the workflow system:
1. Add step type to `WorkflowExecutor._step_handlers` in `app/services/workflow.py`
2. Implement handler method (e.g., `_handle_custom_step`)
3. Create workflow with steps in `Workflow` dataclass
4. Execute via `APIWorkflowExecutor.execute_workflow()`

**Note:** LangFlow integration exists but is primarily for text/LLM workflows. Use API-based executor for media generation workflows.

## Troubleshooting

**Backend won't start:**
- Check `.env` file exists (copy from `.env.example`)
- Verify virtual environment: `cd backend && source .venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

**Frontend build errors:**
- Clear `.next` directory: `rm -rf frontend/.next`
- Reinstall dependencies: `cd frontend && rm -rf node_modules && npm install`

**OpenRouter API errors:**
- Verify `OPENROUTER_API_KEY` in `.env` starts with `sk-or-`
- Check API key is valid at https://openrouter.ai/keys
- Review rate limits and billing at https://openrouter.ai/

**CORS errors:**
- Ensure `CORS_ORIGINS` in `.env` includes frontend URL (default: `http://localhost:3000`)
- For multiple origins, use comma-separated list

## File Organization

**Backend:**
- `app/` - Application code
  - `routers/` - API endpoints (one file per resource)
  - `services/` - Business logic and external API clients
  - `models/` - Pydantic schemas for validation
  - `main.py` - FastAPI app initialization
  - `config.py` - Environment configuration
- `tests/` - Test suites
  - `e2e/` - End-to-end integration tests
- `scripts/` - Utility scripts

**Frontend:**
- `src/app/` - Next.js App Router pages
- `src/components/` - React components
  - `ui/` - Reusable UI primitives
  - Feature components (PhotoCreator, VideoEditor, etc.)
- `src/lib/` - Utilities and API client
