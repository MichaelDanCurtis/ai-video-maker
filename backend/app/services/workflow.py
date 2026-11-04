"""
Workflow orchestration service.

Provides multi-step AI workflow orchestration with LangFlow integration
or API-based fallback for complex AI pipelines.

LangFlow is primarily designed for text/LLM workflows. For media generation
workflows (image, video), the API-based fallback is recommended.
"""

import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Generator, Optional

import httpx

from app.config import Settings, get_settings
from app.services.openrouter import (
    OpenRouterClient,
    OpenRouterError,
    get_openrouter_client_async,
)


class WorkflowError(Exception):
    """Base exception for workflow errors."""

    def __init__(
        self,
        message: str,
        step_id: Optional[str] = None,
        details: Optional[dict] = None,
    ):
        super().__init__(message)
        self.message = message
        self.step_id = step_id
        self.details = details or {}


class WorkflowConnectionError(WorkflowError):
    """Error connecting to workflow orchestration service."""
    pass


class WorkflowExecutionError(WorkflowError):
    """Error during workflow execution."""
    pass


class WorkflowValidationError(WorkflowError):
    """Error validating workflow configuration."""
    pass


class WorkflowStepStatus(str, Enum):
    """Status of a workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStatus(str, Enum):
    """Overall status of a workflow."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStep:
    """
    Represents a single step in a workflow.

    Attributes:
        id: Unique step identifier.
        name: Human-readable step name.
        step_type: Type of step (e.g., 'image_generation', 'text_completion', 'transform').
        config: Step-specific configuration.
        depends_on: List of step IDs this step depends on.
        status: Current step status.
        result: Step execution result.
        error: Error message if step failed.
    """
    id: str
    name: str
    step_type: str
    config: dict = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)
    status: WorkflowStepStatus = WorkflowStepStatus.PENDING
    result: Optional[dict] = None
    error: Optional[str] = None


@dataclass
class Workflow:
    """
    Represents a complete workflow with multiple steps.

    Attributes:
        id: Unique workflow identifier.
        name: Human-readable workflow name.
        steps: List of workflow steps.
        status: Overall workflow status.
        context: Shared context data between steps.
        metadata: Additional workflow metadata.
    """
    id: str
    name: str
    steps: list[WorkflowStep] = field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    context: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


class WorkflowExecutor(ABC):
    """Abstract base class for workflow executors."""

    @abstractmethod
    async def execute_step(
        self,
        step: WorkflowStep,
        context: dict,
    ) -> dict:
        """Execute a single workflow step."""
        pass

    @abstractmethod
    async def execute_workflow(
        self,
        workflow: Workflow,
    ) -> Workflow:
        """Execute a complete workflow."""
        pass


class APIWorkflowExecutor(WorkflowExecutor):
    """
    API-based workflow executor using OpenRouter for AI operations.

    This executor is the fallback/default when LangFlow is not available
    or not suitable for the workflow type.
    """

    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or get_settings()
        self._step_handlers: dict[str, Callable] = {
            "image_generation": self._handle_image_generation,
            "text_completion": self._handle_text_completion,
            "image_edit": self._handle_image_edit,
            "video_generation": self._handle_video_generation,
            "transform": self._handle_transform,
        }

    def register_step_handler(
        self,
        step_type: str,
        handler: Callable,
    ) -> None:
        """Register a custom step handler."""
        self._step_handlers[step_type] = handler

    async def execute_step(
        self,
        step: WorkflowStep,
        context: dict,
    ) -> dict:
        """
        Execute a single workflow step.

        Args:
            step: The step to execute.
            context: Shared context from previous steps.

        Returns:
            Dict containing step results.

        Raises:
            WorkflowExecutionError: If step execution fails.
        """
        handler = self._step_handlers.get(step.step_type)
        if not handler:
            raise WorkflowExecutionError(
                f"Unknown step type: {step.step_type}",
                step_id=step.id,
                details={"available_types": list(self._step_handlers.keys())},
            )

        try:
            # Merge step config with context
            step_input = {**context, **step.config}
            result = await handler(step_input)
            return result
        except OpenRouterError as e:
            raise WorkflowExecutionError(
                f"AI operation failed: {e.message}",
                step_id=step.id,
                details=e.details,
            )
        except Exception as e:
            raise WorkflowExecutionError(
                f"Step execution failed: {str(e)}",
                step_id=step.id,
            )

    async def execute_workflow(
        self,
        workflow: Workflow,
    ) -> Workflow:
        """
        Execute a complete workflow.

        Steps are executed in dependency order. Each step's result
        is added to the workflow context for use by subsequent steps.

        Args:
            workflow: The workflow to execute.

        Returns:
            Updated workflow with results.
        """
        workflow.status = WorkflowStatus.RUNNING
        context = dict(workflow.context)

        # Build dependency graph and execution order
        executed = set()
        pending = list(workflow.steps)

        while pending:
            # Find steps with satisfied dependencies
            ready = [
                step for step in pending
                if all(dep in executed for dep in step.depends_on)
            ]

            if not ready:
                # No steps ready but pending exists = circular dependency
                workflow.status = WorkflowStatus.FAILED
                raise WorkflowValidationError(
                    "Circular dependency detected in workflow",
                    details={"pending_steps": [s.id for s in pending]},
                )

            # Execute ready steps
            for step in ready:
                step.status = WorkflowStepStatus.RUNNING
                try:
                    result = await self.execute_step(step, context)
                    step.result = result
                    step.status = WorkflowStepStatus.COMPLETED
                    # Add result to context for subsequent steps
                    context[f"step_{step.id}"] = result
                except WorkflowExecutionError as e:
                    step.status = WorkflowStepStatus.FAILED
                    step.error = e.message
                    workflow.status = WorkflowStatus.FAILED
                    raise

                executed.add(step.id)
                pending.remove(step)

        workflow.context = context
        workflow.status = WorkflowStatus.COMPLETED
        return workflow

    async def _handle_image_generation(self, config: dict) -> dict:
        """Handle image generation step."""
        prompt = config.get("prompt", "")
        model = config.get("model")
        size = config.get("size", "1024x1024")

        async with get_openrouter_client_async(settings=self._settings) as client:
            result = await client.generate_image_async(
                prompt=prompt,
                model=model,
                size=size,
            )

        return {
            "type": "image",
            "data": result.get("data", []),
            "model": model,
        }

    async def _handle_text_completion(self, config: dict) -> dict:
        """Handle text completion step."""
        messages = config.get("messages", [])
        model = config.get("model", "anthropic/claude-3.5-sonnet")
        max_tokens = config.get("max_tokens")
        temperature = config.get("temperature", 0.7)

        async with get_openrouter_client_async(settings=self._settings) as client:
            result = await client.chat_completion_async(
                messages=messages,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
            )

        return {
            "type": "text",
            "content": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
            "usage": result.get("usage", {}),
        }

    async def _handle_image_edit(self, config: dict) -> dict:
        """Handle image editing step."""
        # Image edit uses a combination of vision model and image generation
        original_image = config.get("image")
        edit_prompt = config.get("edit_prompt", "")
        model = config.get("model")

        # For now, generate new image based on prompt
        async with get_openrouter_client_async(settings=self._settings) as client:
            result = await client.generate_image_async(
                prompt=edit_prompt,
                model=model,
            )

        return {
            "type": "image_edit",
            "data": result.get("data", []),
            "original_image": original_image,
        }

    async def _handle_video_generation(self, config: dict) -> dict:
        """
        Handle video generation step.

        Note: Video generation capability on OpenRouter is unverified.
        This implementation provides the framework for when it becomes available.
        """
        prompt = config.get("prompt", "")
        model = config.get("model")
        duration = config.get("duration", 5)

        # Video generation is currently unverified on OpenRouter
        # Return a placeholder indicating the feature status
        return {
            "type": "video",
            "status": "unavailable",
            "message": "Video generation is not yet verified on OpenRouter. "
                      "Consider using alternative providers for video generation.",
            "prompt": prompt,
            "model": model,
            "duration": duration,
        }

    async def _handle_transform(self, config: dict) -> dict:
        """Handle generic transform step."""
        transform_type = config.get("transform_type", "")
        input_data = config.get("input")

        return {
            "type": "transform",
            "transform_type": transform_type,
            "input": input_data,
            "status": "pending",
        }


class LangFlowExecutor(WorkflowExecutor):
    """
    LangFlow-based workflow executor.

    Integrates with LangFlow for visual workflow orchestration.
    Best suited for text/LLM workflows.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        settings: Optional[Settings] = None,
        timeout: float = 120.0,
    ):
        self._settings = settings or get_settings()
        self._base_url = (base_url or self._settings.langflow_base_url).rstrip("/")
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def is_available(self) -> bool:
        """Check if LangFlow service is available."""
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except Exception:
            return False

    async def execute_step(
        self,
        step: WorkflowStep,
        context: dict,
    ) -> dict:
        """
        Execute a step via LangFlow API.

        Note: This is a placeholder for actual LangFlow integration.
        The actual implementation depends on LangFlow's API structure.
        """
        flow_id = step.config.get("flow_id")
        if not flow_id:
            raise WorkflowValidationError(
                "LangFlow step requires flow_id in config",
                step_id=step.id,
            )

        try:
            response = await self.client.post(
                f"/api/v1/run/{flow_id}",
                json={
                    "inputs": {**context, **step.config.get("inputs", {})},
                },
            )

            if response.status_code >= 400:
                raise WorkflowExecutionError(
                    f"LangFlow execution failed: {response.text}",
                    step_id=step.id,
                )

            return response.json()
        except httpx.RequestError as e:
            raise WorkflowConnectionError(
                f"Failed to connect to LangFlow: {str(e)}",
                step_id=step.id,
            )

    async def execute_workflow(
        self,
        workflow: Workflow,
    ) -> Workflow:
        """
        Execute workflow via LangFlow.

        For LangFlow, the workflow may be defined in the LangFlow UI
        and executed as a single flow, or as individual steps.
        """
        workflow.status = WorkflowStatus.RUNNING
        context = dict(workflow.context)

        for step in workflow.steps:
            step.status = WorkflowStepStatus.RUNNING
            try:
                result = await self.execute_step(step, context)
                step.result = result
                step.status = WorkflowStepStatus.COMPLETED
                context[f"step_{step.id}"] = result
            except WorkflowError as e:
                step.status = WorkflowStepStatus.FAILED
                step.error = e.message
                workflow.status = WorkflowStatus.FAILED
                raise

        workflow.context = context
        workflow.status = WorkflowStatus.COMPLETED
        return workflow


class WorkflowService:
    """
    Main workflow orchestration service.

    Provides a unified interface for executing AI workflows,
    automatically selecting between LangFlow and API-based execution
    based on configuration and availability.

    Usage:
        # Async context manager (recommended)
        async with WorkflowService() as service:
            workflow = await service.create_workflow("My Pipeline")
            workflow = await service.add_step(workflow, "gen_image", "image_generation", {...})
            result = await service.execute(workflow)

        # Direct instantiation
        service = WorkflowService()
        try:
            workflow = await service.execute(workflow)
        finally:
            await service.close()
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        prefer_langflow: bool = True,
    ):
        """
        Initialize the workflow service.

        Args:
            settings: Application settings. If not provided, uses get_settings().
            prefer_langflow: If True, prefer LangFlow when available. Defaults to True.
        """
        self._settings = settings or get_settings()
        self._prefer_langflow = prefer_langflow
        self._langflow_executor: Optional[LangFlowExecutor] = None
        self._api_executor: Optional[APIWorkflowExecutor] = None
        self._langflow_available: Optional[bool] = None

    @property
    def langflow_enabled(self) -> bool:
        """Check if LangFlow is enabled in settings."""
        return self._settings.langflow_enabled

    def _get_api_executor(self) -> APIWorkflowExecutor:
        """Get or create API-based executor."""
        if self._api_executor is None:
            self._api_executor = APIWorkflowExecutor(settings=self._settings)
        return self._api_executor

    async def _get_langflow_executor(self) -> LangFlowExecutor:
        """Get or create LangFlow executor."""
        if self._langflow_executor is None:
            self._langflow_executor = LangFlowExecutor(settings=self._settings)
        return self._langflow_executor

    async def is_langflow_available(self) -> bool:
        """
        Check if LangFlow service is available.

        Caches the result for performance.
        """
        if self._langflow_available is None:
            if not self.langflow_enabled:
                self._langflow_available = False
            else:
                executor = await self._get_langflow_executor()
                self._langflow_available = await executor.is_available()
        return self._langflow_available

    async def _get_executor(self, use_langflow: Optional[bool] = None) -> WorkflowExecutor:
        """
        Get the appropriate workflow executor.

        Args:
            use_langflow: Override to force LangFlow or API executor.
                         None = auto-detect based on preference and availability.

        Returns:
            Appropriate WorkflowExecutor instance.
        """
        if use_langflow is None:
            use_langflow = self._prefer_langflow and await self.is_langflow_available()

        if use_langflow:
            return await self._get_langflow_executor()
        return self._get_api_executor()

    def generate_id(self, prefix: str = "wf") -> str:
        """Generate a unique ID."""
        return f"{prefix}_{uuid.uuid4().hex[:12]}"

    async def create_workflow(
        self,
        name: str,
        context: Optional[dict] = None,
        metadata: Optional[dict] = None,
    ) -> Workflow:
        """
        Create a new workflow.

        Args:
            name: Human-readable workflow name.
            context: Initial context data.
            metadata: Additional metadata.

        Returns:
            New Workflow instance.
        """
        return Workflow(
            id=self.generate_id("wf"),
            name=name,
            context=context or {},
            metadata=metadata or {},
        )

    async def add_step(
        self,
        workflow: Workflow,
        step_id: str,
        step_type: str,
        config: dict,
        name: Optional[str] = None,
        depends_on: Optional[list[str]] = None,
    ) -> Workflow:
        """
        Add a step to a workflow.

        Args:
            workflow: The workflow to modify.
            step_id: Unique step identifier.
            step_type: Type of step.
            config: Step configuration.
            name: Human-readable step name.
            depends_on: List of step IDs this step depends on.

        Returns:
            Updated workflow.
        """
        step = WorkflowStep(
            id=step_id,
            name=name or step_id,
            step_type=step_type,
            config=config,
            depends_on=depends_on or [],
        )
        workflow.steps.append(step)
        return workflow

    async def execute(
        self,
        workflow: Workflow,
        use_langflow: Optional[bool] = None,
    ) -> Workflow:
        """
        Execute a workflow.

        Args:
            workflow: The workflow to execute.
            use_langflow: Override executor selection.
                         None = auto-detect.

        Returns:
            Executed workflow with results.

        Raises:
            WorkflowError: On execution failure.
        """
        executor = await self._get_executor(use_langflow)
        return await executor.execute_workflow(workflow)

    async def execute_single_step(
        self,
        step_type: str,
        config: dict,
        use_langflow: Optional[bool] = None,
    ) -> dict:
        """
        Execute a single step without creating a full workflow.

        Convenience method for simple one-step operations.

        Args:
            step_type: Type of step to execute.
            config: Step configuration.
            use_langflow: Override executor selection.

        Returns:
            Step execution result.
        """
        step = WorkflowStep(
            id=self.generate_id("step"),
            name="single_step",
            step_type=step_type,
            config=config,
        )
        executor = await self._get_executor(use_langflow)
        return await executor.execute_step(step, {})

    async def close(self) -> None:
        """Close all resources."""
        if self._langflow_executor is not None:
            await self._langflow_executor.close()
            self._langflow_executor = None
        # API executor doesn't need explicit cleanup

    # =========================================================================
    # Context Manager Protocol
    # =========================================================================

    async def __aenter__(self) -> "WorkflowService":
        """Enter async context manager."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit async context manager and cleanup resources."""
        await self.close()


# =============================================================================
# Convenience Workflow Builders
# =============================================================================


async def create_image_generation_workflow(
    prompt: str,
    model: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> Workflow:
    """
    Create a simple image generation workflow.

    Args:
        prompt: Image generation prompt.
        model: Optional model override.
        settings: Optional settings override.

    Returns:
        Configured workflow ready for execution.
    """
    settings = settings or get_settings()
    model = model or settings.default_image_model

    async with WorkflowService(settings=settings) as service:
        workflow = await service.create_workflow("Image Generation")
        workflow = await service.add_step(
            workflow,
            step_id="generate",
            step_type="image_generation",
            config={
                "prompt": prompt,
                "model": model,
            },
        )
        return workflow


async def create_image_with_caption_workflow(
    prompt: str,
    caption_prompt: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> Workflow:
    """
    Create a multi-step workflow that generates an image and adds a caption.

    Args:
        prompt: Image generation prompt.
        caption_prompt: Optional prompt for caption generation.
        settings: Optional settings override.

    Returns:
        Configured workflow with image generation and captioning steps.
    """
    settings = settings or get_settings()

    async with WorkflowService(settings=settings) as service:
        workflow = await service.create_workflow("Image with Caption")

        # Step 1: Generate image
        workflow = await service.add_step(
            workflow,
            step_id="generate_image",
            step_type="image_generation",
            config={"prompt": prompt},
        )

        # Step 2: Generate caption (depends on image)
        workflow = await service.add_step(
            workflow,
            step_id="generate_caption",
            step_type="text_completion",
            name="Generate Caption",
            depends_on=["generate_image"],
            config={
                "messages": [
                    {
                        "role": "user",
                        "content": caption_prompt or f"Write a creative caption for an image of: {prompt}",
                    }
                ],
                "max_tokens": 100,
            },
        )

        return workflow


# =============================================================================
# Factory Functions
# =============================================================================


@asynccontextmanager
async def get_workflow_service(
    settings: Optional[Settings] = None,
    prefer_langflow: bool = True,
) -> AsyncGenerator[WorkflowService, None]:
    """
    Async context manager factory for WorkflowService.

    Usage:
        async with get_workflow_service() as service:
            workflow = await service.create_workflow("My Workflow")
            result = await service.execute(workflow)

    Args:
        settings: Optional settings override.
        prefer_langflow: If True, prefer LangFlow when available.

    Yields:
        Configured WorkflowService instance.
    """
    service = WorkflowService(settings=settings, prefer_langflow=prefer_langflow)
    try:
        yield service
    finally:
        await service.close()
