import os
from langchain_groq import ChatGroq
from dotenv import load_dotenv

from ai_engine.schema.analysis_schema import DocumentAnalysis, SummaryResult, ConceptsResult, QuestionsResult
from ai_engine.prompts.tool_prompts import summary_prompt, questions_prompt, concepts_prompt, detailed_prompt

load_dotenv()

groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
model = ChatGroq(model=groq_model)

summary_structured_chain = summary_prompt | model.with_structured_output(SummaryResult)

concepts_structured_chain = concepts_prompt | model.with_structured_output(ConceptsResult)

questions_structured_chain = questions_prompt | model.with_structured_output(QuestionsResult)

full_analysis_chain = detailed_prompt | model.with_structured_output(DocumentAnalysis)
