import type { NormalizedEIS223Tender } from "../adapters/eis-223-adapter";

export const eis223TenderFixtures = [
  {
    externalId: "eis223-mock-001",
    registryNumber: "32414000123",
    lotNumber: "1",
    title: "Поставка стоматологических расходных материалов для сети клиник",
    description:
      "Набор терапевтических, хирургических и ортопедических материалов с поставкой партиями.",
    customerInn: "7708123456",
    customerName: "АО \"Медицинские технологии Север\"",
    purchaseMethod: "Запрос котировок в электронной форме",
    maxPrice: "14850000.00",
    currency: "RUB",
    region: "Москва",
    sourceUrl: "https://zakupki.gov.ru/223/mock/32414000123",
    publishedAt: "2026-05-20T09:30:00.000+03:00",
    applicationStartAt: "2026-05-20T10:00:00.000+03:00",
    applicationDeadlineAt: "2026-05-29T12:00:00.000+03:00",
    clarificationDeadlineAt: "2026-05-27T18:00:00.000+03:00",
    resultAt: "2026-06-04T17:00:00.000+03:00",
    bidSecurityAmount: "148500.00",
    contractSecurityAmount: "742500.00",
    paymentTerms: "Оплата в течение 15 рабочих дней после приемки партии товара.",
    participationRequirements: [
      "Поставка медицинских изделий с регистрационными удостоверениями",
      "Отсутствие в реестре недобросовестных поставщиков",
      "Подтвержденный опыт поставок расходных материалов"
    ],
    requiredDocuments: [
      "Коммерческое предложение",
      "Декларация соответствия требованиям 223-ФЗ",
      "Копии регистрационных удостоверений"
    ],
    evaluationCriteria: [
      "Цена договора",
      "Срок поставки",
      "Гарантийные обязательства"
    ],
    changesFeed: [
      {
        at: "2026-05-22T13:10:00.000+03:00",
        title: "Опубликовано разъяснение",
        description: "Заказчик уточнил требования к партиям поставки."
      }
    ],
    sourceStage: "SUBMISSION_OPEN",
    kanbanStageCode: "INBOX",
    decision: "REVIEW",
    documents: [
      {
        externalId: "eis223-mock-001-notice",
        type: "NOTICE",
        title: "Извещение о закупке",
        fileName: "32414000123-notice.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414000123/notice.pdf"
      },
      {
        externalId: "eis223-mock-001-docs",
        type: "PROCUREMENT_DOCUMENTATION",
        title: "Закупочная документация",
        fileName: "32414000123-docs.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414000123/docs.pdf"
      },
      {
        externalId: "eis223-mock-001-ts",
        type: "TECHNICAL_SPECIFICATION",
        title: "Техническое задание",
        fileName: "32414000123-spec.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414000123/spec.pdf"
      }
    ]
  },
  {
    externalId: "eis223-mock-002",
    registryNumber: "32414000487",
    lotNumber: "1",
    title: "Оказание услуг по сервисному обслуживанию диагностического оборудования",
    description:
      "Плановое обслуживание, диагностика неисправностей и поставка расходных комплектующих.",
    customerInn: "7810456789",
    customerName: "ГАУЗ \"Городской диагностический центр\"",
    purchaseMethod: "Конкурс в электронной форме",
    maxPrice: "6200000.00",
    currency: "RUB",
    region: "Санкт-Петербург",
    sourceUrl: "https://zakupki.gov.ru/223/mock/32414000487",
    publishedAt: "2026-05-18T11:10:00.000+03:00",
    applicationStartAt: "2026-05-19T09:00:00.000+03:00",
    applicationDeadlineAt: "2026-06-03T18:00:00.000+03:00",
    clarificationDeadlineAt: "2026-05-30T12:00:00.000+03:00",
    resultAt: "2026-06-09T16:00:00.000+03:00",
    bidSecurityAmount: "62000.00",
    contractSecurityAmount: "310000.00",
    paymentTerms: "Оплата ежемесячно по актам оказанных услуг в течение 10 рабочих дней.",
    participationRequirements: [
      "Сервисная команда с допусками производителя",
      "Наличие склада расходных комплектующих",
      "Отсутствие просроченной задолженности перед заказчиком"
    ],
    requiredDocuments: [
      "Лицензии и сертификаты сервисных инженеров",
      "Регламент обслуживания",
      "Смета запасных частей"
    ],
    evaluationCriteria: [
      "Цена",
      "Квалификация персонала",
      "Срок реакции на заявку"
    ],
    changesFeed: [],
    sourceStage: "SUBMISSION_OPEN",
    kanbanStageCode: "QUALIFY",
    decision: "UNDECIDED",
    documents: [
      {
        externalId: "eis223-mock-002-notice",
        type: "NOTICE",
        title: "Извещение",
        fileName: "32414000487-notice.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414000487/notice.pdf"
      },
      {
        externalId: "eis223-mock-002-contract",
        type: "DRAFT_CONTRACT",
        title: "Проект договора",
        fileName: "32414000487-contract.pdf",
        status: "EXTERNAL_ONLY",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414000487/contract.pdf"
      }
    ]
  },
  {
    externalId: "eis223-mock-003",
    registryNumber: "32414000991",
    lotNumber: "2",
    title: "Поставка офисной мебели для филиалов заказчика",
    description: "Рабочие места, шкафы хранения и мебель для переговорных комнат.",
    customerInn: "5406112233",
    customerName: "ООО \"Сибирская энергетическая компания\"",
    purchaseMethod: "Аукцион в электронной форме",
    maxPrice: "2350000.00",
    currency: "RUB",
    region: "Новосибирская область",
    sourceUrl: "https://zakupki.gov.ru/223/mock/32414000991",
    publishedAt: "2026-05-15T08:45:00.000+03:00",
    applicationStartAt: "2026-05-15T09:00:00.000+03:00",
    applicationDeadlineAt: "2026-05-27T10:00:00.000+03:00",
    clarificationDeadlineAt: "2026-05-24T18:00:00.000+03:00",
    resultAt: "2026-05-31T12:00:00.000+03:00",
    bidSecurityAmount: "23500.00",
    contractSecurityAmount: "117500.00",
    paymentTerms: "Оплата после поставки и подписания закрывающих документов.",
    participationRequirements: [
      "Соответствие мебели техническому заданию",
      "Гарантия не менее 24 месяцев"
    ],
    requiredDocuments: [
      "Спецификация",
      "Сертификаты качества",
      "Гарантийное письмо"
    ],
    evaluationCriteria: [
      "Цена",
      "Срок поставки",
      "Гарантийный срок"
    ],
    changesFeed: [
      {
        at: "2026-05-23T10:40:00.000+03:00",
        title: "Прием заявок завершен",
        description: "Статус источника перешел в рассмотрение заявок."
      }
    ],
    sourceStage: "UNKNOWN",
    kanbanStageCode: "GO",
    decision: "BID",
    documents: []
  },
  {
    externalId: "eis223-mock-004",
    registryNumber: "32414001402",
    lotNumber: "1",
    title: "Разработка и внедрение модуля электронного документооборота",
    description:
      "Интеграция с внутренними учетными системами, настройка маршрутов согласования и обучение.",
    customerInn: "6671023344",
    customerName: "АО \"Уральская транспортная дирекция\"",
    purchaseMethod: "Запрос предложений",
    maxPrice: "27800000.00",
    currency: "RUB",
    region: "Свердловская область",
    sourceUrl: "https://zakupki.gov.ru/223/mock/32414001402",
    publishedAt: "2026-05-10T14:20:00.000+03:00",
    applicationStartAt: "2026-05-11T10:00:00.000+03:00",
    applicationDeadlineAt: "2026-06-10T09:00:00.000+03:00",
    clarificationDeadlineAt: "2026-06-05T12:00:00.000+03:00",
    resultAt: "2026-06-19T18:00:00.000+03:00",
    bidSecurityAmount: "278000.00",
    contractSecurityAmount: "1390000.00",
    paymentTerms: "30% аванс после подписания договора, остаток после приемки этапов.",
    participationRequirements: [
      "Опыт внедрения ЭДО в распределенных организациях",
      "Команда аналитиков и интеграторов",
      "Поддержка интеграции с учетными системами"
    ],
    requiredDocuments: [
      "Проектный план",
      "Описание архитектуры решения",
      "Резюме ключевых специалистов"
    ],
    evaluationCriteria: [
      "Цена",
      "Методология внедрения",
      "Опыт аналогичных проектов"
    ],
    changesFeed: [
      {
        at: "2026-05-21T15:25:00.000+03:00",
        title: "Размещено разъяснение",
        description: "Уточнены требования к маршрутам согласования."
      },
      {
        at: "2026-05-24T12:15:00.000+03:00",
        title: "Опубликован протокол",
        description: "В mock source появились результаты рассмотрения."
      }
    ],
    sourceStage: "COMPLETED",
    kanbanStageCode: "PREPARE",
    decision: "REVIEW",
    documents: [
      {
        externalId: "eis223-mock-004-docs",
        type: "PROCUREMENT_DOCUMENTATION",
        title: "Документация о закупке",
        fileName: "32414001402-docs.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414001402/docs.pdf"
      },
      {
        externalId: "eis223-mock-004-clarification",
        type: "CLARIFICATION",
        title: "Разъяснение положений документации",
        fileName: "32414001402-clarification.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414001402/clarification.pdf"
      }
    ]
  },
  {
    externalId: "eis223-mock-005",
    registryNumber: "32414001977",
    lotNumber: "1",
    title: "Поставка средств индивидуальной защиты для производственных площадок",
    description:
      "Комплекты СИЗ для сезонной эксплуатации с требованиями по сертификации и срокам годности.",
    customerInn: "2466007788",
    customerName: "ПАО \"Енисейская горнорудная компания\"",
    purchaseMethod: "Закупка у единственного поставщика",
    maxPrice: "910000.00",
    currency: "RUB",
    region: "Красноярский край",
    sourceUrl: "https://zakupki.gov.ru/223/mock/32414001977",
    publishedAt: "2026-05-12T16:05:00.000+03:00",
    applicationStartAt: "2026-05-12T16:30:00.000+03:00",
    applicationDeadlineAt: "2026-06-17T15:30:00.000+03:00",
    clarificationDeadlineAt: "2026-06-12T18:00:00.000+03:00",
    resultAt: "2026-06-20T11:00:00.000+03:00",
    bidSecurityAmount: "0.00",
    contractSecurityAmount: "45500.00",
    paymentTerms: "Оплата в течение 7 рабочих дней после поставки на склад заказчика.",
    participationRequirements: [
      "Сертификаты соответствия СИЗ",
      "Срок годности на момент поставки не менее 12 месяцев"
    ],
    requiredDocuments: [
      "Паспорта качества",
      "Декларация соответствия",
      "График поставки"
    ],
    evaluationCriteria: [
      "Цена",
      "Срок поставки",
      "Соответствие сертификатов"
    ],
    changesFeed: [],
    sourceStage: "COMMISSION_WORK",
    kanbanStageCode: "SUBMITTED_EXTERNALLY",
    decision: "NO_BID",
    documents: [
      {
        externalId: "eis223-mock-005-notice",
        type: "NOTICE",
        title: "Извещение",
        fileName: "32414001977-notice.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414001977/notice.pdf"
      },
      {
        externalId: "eis223-mock-005-ts",
        type: "TECHNICAL_SPECIFICATION",
        title: "Технические требования",
        fileName: "32414001977-spec.pdf",
        status: "AVAILABLE",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414001977/spec.pdf"
      },
      {
        externalId: "eis223-mock-005-protocol",
        type: "PROTOCOL",
        title: "Протокол рассмотрения",
        fileName: "32414001977-protocol.pdf",
        status: "EXTERNAL_ONLY",
        sourceUrl: "https://zakupki.gov.ru/223/mock/32414001977/protocol.pdf"
      }
    ]
  }
] satisfies NormalizedEIS223Tender[];
