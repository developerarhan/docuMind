from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional
from datetime import datetime, timezone


class UserMemory(BaseModel):
    # The actual fact or information.
    memory: str = Field(
        description="The actual fact or information to remember."
    )
    #  The type of memory.
    category: Literal[
        "preference",
        "learning_goal",
        "personal_context",
        "interest",
        "other"
    ] = Field(
        description="The category of this memory."
    )
    # When the memory was created.
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Date and time when this memory was created."
    )


class MemoryExtractionResult(BaseModel):
    memories: list[UserMemory] = Field(
        default_factory=list,
        description=(
            "Extract zero, one, or multiple useful and reusable "
            "memories about the user. Include stable preferences, "
            "learning goals, personal context, and other information "
            "that may be useful in future conversations. "
            "Do not extract temporary questions, one-time requests, "
            "or ordinary conversation."
        )
    )


class MemoryDecision(BaseModel):
    action: Literal["CREATE", "UPDATE", "DELETE", "NO_ACTION"]

    memory_id: Optional[int] = None

    reason: str

    @model_validator(mode="after")
    def validate_memory_id(self):
        if self.action in ("UPDATE", "DELETE") and self.memory_id is None:
            raise ValueError(
                f"memory_id is required when action is {self.action}"
            )

        if self.action in ("CREATE", "NO_ACTION") and self.memory_id is not None:
            raise ValueError(
                f"memory_id must be None when action is {self.action}"
            )

        return self
