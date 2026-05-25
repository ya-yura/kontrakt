# AI and document pipeline

## Цель

AI-модуль сокращает чтение документации, но не заменяет юридическую и коммерческую проверку. Он должен быть extractive: каждый факт, риск, дедлайн и требование сопровождается source span.

## Pipeline

1. Next.js создает `Document` со статусом `PENDING`.
2. `POST /api/cron/analysis/run` выбирает batch документов.
3. Next.js вызывает FastAPI `POST /v1/documents/extract-text`.
4. FastAPI пытается извлечь text layer.
5. Если text layer отсутствует, FastAPI возвращает `OCR_REQUIRED` или запускает OCR fallback по настройке.
6. Next.js сохраняет `textContent`, `textChecksum`, `pageCount`, `hasTextLayer`.
7. Next.js создает или активирует `AIAnalysis` со статусом `PENDING`.
8. FastAPI выполняет chunking и вызывает LLM.
9. LLM возвращает JSON строго по схеме.
10. Next.js валидирует JSON и сохраняет `AIAnalysis`.
11. Scoring engine использует extracted fields, но не доверяет AI без confidence и citations.

## System prompt v1

```text
Ты - аналитик закупочной документации по 223-ФЗ.
Твоя задача - делать только extractive analysis.
Нельзя додумывать требования, сроки, допуски, сертификаты, основания отклонения или условия договора.
Если информации нет прямо в тексте, верни null или добавь пункт в unknowns.

Контекст:
- Ниже передан текст извещения, документации, изменений, разъяснений и/или протоколов.
- Нужно помочь поставщику быстро принять решение "участвовать / не участвовать".
- Вывод только в JSON по заданной схеме.
- Все извлеченные факты должны иметь source_spans: document_title, page_or_section, short_quote.
```

## JSON output contract

```json
{
  "executive_summary": "string",
  "participation_recommendation_hint": {
    "status": "bid|review|no_bid",
    "confidence": 0
  },
  "deadlines": [
    {
      "type": "application_deadline|clarification_deadline|result_date|contract_signing",
      "value": "ISO-8601 or null",
      "source_spans": []
    }
  ],
  "financial_terms": {
    "max_price": "number|null",
    "currency": "string|null",
    "application_security": "number|null",
    "contract_security": "number|null",
    "payment_terms": "string|null",
    "source_spans": []
  },
  "requirements": [
    {
      "category": "license|certificate|experience|staff|equipment|product_spec|delivery|financial|other",
      "title": "string",
      "mandatory": true,
      "value": "string|null",
      "source_spans": []
    }
  ],
  "requested_documents": [
    {
      "title": "string",
      "mandatory": true,
      "source_spans": []
    }
  ],
  "evaluation_criteria": [
    {
      "name": "string",
      "weight": "number|null",
      "source_spans": []
    }
  ],
  "risks": [
    {
      "severity": "low|medium|high",
      "risk": "string",
      "why_it_matters": "string",
      "source_spans": []
    }
  ],
  "unknowns": [
    {
      "question": "string",
      "why_blocking": "string"
    }
  ]
}
```

## AI guardrails

- Нет цитаты - нет факта.
- Нет документа - `unknowns`, а не предположение.
- Если положение о закупке заказчика не анализировалось, снижать confidence на 10-20 пунктов.
- Если `confidence < 60`, scoring не может вернуть `BID`.
- Если найдены hard blockers, итог `NO_BID` даже при высоком общем score.
- Не отправлять в LLM секреты пользователя, токены, cookies, приватные заметки и вложения, не относящиеся к закупке.

## Chunking

MVP-правило:

- сначала анализировать извещение и документацию;
- затем изменения и разъяснения;
- затем протоколы и результат;
- chunk должен сохранять `document_title`, `page_or_section`, `chunk_index`.

## Evaluation dataset

Для финального QA собрать 10-15 закупок:

- 5 с нормальным text layer;
- 3-5 со сканами или плохими PDF;
- 3 с изменениями/разъяснениями;
- 2 с явными hard blockers;
- 2 с неполной документацией.

На каждой закупке проверить:

- дедлайн подачи;
- обеспечение заявки/договора;
- обязательные документы;
- требования к участнику;
- критерии оценки;
- 3-5 meaningful risks;
- наличие `unknowns`, если данных не хватает.

