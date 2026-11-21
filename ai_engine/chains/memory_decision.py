import os
from langchain_groq import ChatGroq
from dotenv import load_dotenv

from ai_engine.prompts.memory_prompts import memory_decision_prompt
from ai_engine.memory.schemas import MemoryDecision

load_dotenv()

groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
model = ChatGroq(
    model=groq_model
)

memory_decision_chain = memory_decision_prompt | model.with_structured_output(MemoryDecision)
