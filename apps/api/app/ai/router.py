from fastapi import APIRouter

from app.ai.schemas import (
    AIAnalysisResponse,
    DiffDocumentRequest,
    SummarizeDocumentRequest,
    SummarizeTenderRequest,
)
from app.ai.service import diff_document, summarize_document, summarize_tender


router = APIRouter(prefix="/v1/ai", tags=["ai"])


@router.post("/summarize-document", response_model=AIAnalysisResponse)
def summarize_document_endpoint(request: SummarizeDocumentRequest) -> AIAnalysisResponse:
    return summarize_document(request)


@router.post("/summarize-tender", response_model=AIAnalysisResponse)
def summarize_tender_endpoint(request: SummarizeTenderRequest) -> AIAnalysisResponse:
    return summarize_tender(request)


@router.post("/diff-document", response_model=AIAnalysisResponse)
def diff_document_endpoint(request: DiffDocumentRequest) -> AIAnalysisResponse:
    return diff_document(request)
