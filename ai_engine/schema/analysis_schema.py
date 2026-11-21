from pydantic import BaseModel, Field


class SummaryResult(BaseModel):
    summary: str = Field(
        description="A concise summary of the document."
    )

class Concept(BaseModel):
    name: str = Field(description="Name of a concept")
    explanation: str = Field(description="A short explanation of a concept.")

class ConceptsResult(BaseModel):
    concepts: list[Concept] = Field(
        description="Five important concepts with short explanations."
    )

class QuestionsResult(BaseModel):
    questions: list[str] = Field(
        description="Five questions based on the document."
    )

class DocumentAnalysis(BaseModel):
    summary: str = Field(
        description="A concise summary of the document."
    )

    concepts: list[Concept] = Field(
        description="Five important concepts with short explanations."
    )

    questions: list[str] = Field(
        description="Five questions based on the document."
    )
    