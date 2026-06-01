from fastapi import APIRouter

from app.documents.schemas import DocumentTextExtractionRequest, DocumentTextExtractionResponse
from app.documents.service import extract_document_text


router = APIRouter(prefix="/v1/documents", tags=["documents"])


@router.post("/extract-text", response_model=DocumentTextExtractionResponse)
def extract_text(request: DocumentTextExtractionRequest) -> DocumentTextExtractionResponse:
    return extract_document_text(request)
