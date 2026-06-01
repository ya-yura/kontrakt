import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export type FileProxyDocumentRecord = {
  id: string;
  title: string;
  fileName: string | null;
  status: string;
  sourceUrl: string | null;
  storageKey: string | null;
  tender: {
    id: string;
    ownerId: string | null;
  };
};

export type FileProxyStore = {
  findOwnedDocumentForProxy(
    documentId: string,
    userId: string
  ): Promise<FileProxyDocumentRecord | null>;
};

export type FileProxyOptions = {
  store: FileProxyStore;
  userId: string;
  documentId: string;
  fetchFile?: typeof fetch;
  allowedHosts?: string[];
  storageRoot?: string | null;
};

const DEFAULT_ALLOWED_HOSTS = ["zakupki.gov.ru"];
const MAX_FILE_PROXY_REDIRECTS = 3;
const URL_LIKE_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const FILE_NAME_SAFE_PATTERN = /[^A-Za-z0-9._-]/g;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const SAFE_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/octet-stream",
  "application/zip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain"
};

function jsonError(message: string, status: number) {
  return Response.json(
    {
      error: message
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

function defaultAllowedHosts() {
  const configured = process.env.FILE_PROXY_ALLOWED_HOSTS?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_HOSTS;
}

function normalizeAllowedHosts(hosts: string[] | undefined) {
  return (hosts && hosts.length > 0 ? hosts : defaultAllowedHosts()).map((host) =>
    host.toLowerCase()
  );
}

function isAllowedHost(hostname: string, allowedHosts: string[]) {
  const normalizedHost = hostname.toLowerCase();

  return allowedHosts.some(
    (allowedHost) =>
      normalizedHost === allowedHost || normalizedHost.endsWith(`.${allowedHost}`)
  );
}

function getSafeExternalUrl(rawUrl: string | null, allowedHosts: string[]) {
  if (!rawUrl?.trim()) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, allowedHosts)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isHttpUrl(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isSafeRedirectUrl(url: URL, allowedHosts: string[]) {
  return isHttpUrl(url) && isAllowedHost(url.hostname, allowedHosts);
}

function safeFileName(document: FileProxyDocumentRecord) {
  const candidate = document.fileName?.trim() || `${document.title.trim() || document.id}.pdf`;
  const ascii = candidate.replace(FILE_NAME_SAFE_PATTERN, "_").slice(0, 120) || "document.pdf";

  return {
    original: candidate,
    ascii
  };
}

function contentDisposition(document: FileProxyDocumentRecord) {
  const fileName = safeFileName(document);

  return `inline; filename="${fileName.ascii}"; filename*=UTF-8''${encodeURIComponent(
    fileName.original
  )}`;
}

function contentTypeFromFileName(fileName: string | null) {
  if (!fileName) {
    return null;
  }

  return CONTENT_TYPES_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? null;
}

function safeContentType(rawContentType: string | null, fileName: string | null) {
  const normalizedContentType = rawContentType?.split(";")[0]?.trim().toLowerCase() ?? null;

  if (normalizedContentType === "text/html") {
    return null;
  }

  if (normalizedContentType && SAFE_CONTENT_TYPES.has(normalizedContentType)) {
    return normalizedContentType;
  }

  return contentTypeFromFileName(fileName);
}

function fileResponse(input: {
  body: BodyInit;
  contentType: string;
  document: FileProxyDocumentRecord;
  contentLength?: string | null;
}) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(input.document),
    "Content-Type": input.contentType,
    "X-Content-Type-Options": "nosniff"
  });

  if (input.contentLength) {
    headers.set("Content-Length", input.contentLength);
  }

  return new Response(input.body, {
    status: 200,
    headers
  });
}

function resolveStoragePath(storageRoot: string, storageKey: string) {
  if (!storageKey.trim() || path.isAbsolute(storageKey) || storageKey.includes("\0")) {
    return null;
  }

  const root = path.resolve(storageRoot);
  const candidate = path.resolve(root, storageKey);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (candidate !== root && !candidate.startsWith(rootPrefix)) {
    return null;
  }

  return candidate;
}

async function tryServeStorageFile(
  document: FileProxyDocumentRecord,
  storageRoot: string | null | undefined
) {
  if (!document.storageKey || !storageRoot?.trim()) {
    return null;
  }

  const filePath = resolveStoragePath(storageRoot, document.storageKey);

  if (!filePath) {
    return jsonError("File is unavailable.", 404);
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return jsonError("File is unavailable.", 404);
    }

    const contentType = safeContentType(null, document.fileName ?? filePath);

    if (!contentType) {
      return jsonError("File type is not supported.", 415);
    }

    return fileResponse({
      body: await readFile(filePath),
      contentType,
      contentLength: String(fileStat.size),
      document
    });
  } catch {
    return null;
  }
}

async function fetchExternalFile(input: {
  document: FileProxyDocumentRecord;
  url: URL;
  fetchFile: typeof fetch;
  allowedHosts: string[];
}) {
  let upstream: Response | null = null;
  let currentUrl = input.url;

  for (let redirectCount = 0; redirectCount <= MAX_FILE_PROXY_REDIRECTS; redirectCount += 1) {
    try {
      upstream = await input.fetchFile(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept:
            "application/pdf,application/zip,application/octet-stream,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain;q=0.8"
        }
      });
    } catch {
      return jsonError("File is unavailable.", 502);
    }

    if (!REDIRECT_STATUS_CODES.has(upstream.status)) {
      break;
    }

    const location = upstream.headers.get("location");

    if (!location) {
      return jsonError("File redirect is invalid.", 502);
    }

    let nextUrl: URL;

    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      return jsonError("File redirect is invalid.", 502);
    }

    if (!isSafeRedirectUrl(nextUrl, input.allowedHosts)) {
      return jsonError("File redirect is not allowed.", 403);
    }

    currentUrl = nextUrl;

    if (redirectCount === MAX_FILE_PROXY_REDIRECTS) {
      return jsonError("File redirect limit exceeded.", 502);
    }
  }

  if (!upstream) {
    return jsonError("File is unavailable.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return jsonError("File is unavailable.", 502);
  }

  const contentType = safeContentType(upstream.headers.get("content-type"), input.document.fileName);

  if (!contentType) {
    return jsonError("File type is not supported.", 415);
  }

  return fileResponse({
    body: upstream.body,
    contentType,
    contentLength: upstream.headers.get("content-length"),
    document: input.document
  });
}

export async function proxyDocumentFileForUser({
  store,
  userId,
  documentId,
  fetchFile = fetch,
  allowedHosts,
  storageRoot = process.env.FILE_STORAGE_ROOT ?? null
}: FileProxyOptions) {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId || URL_LIKE_PATTERN.test(normalizedDocumentId)) {
    return jsonError("Document not found.", 404);
  }

  const document = await store.findOwnedDocumentForProxy(normalizedDocumentId, userId);

  if (!document || document.status === "MISSING") {
    return jsonError("Document not found.", 404);
  }

  const storageResponse = await tryServeStorageFile(document, storageRoot);

  if (storageResponse) {
    return storageResponse;
  }

  const normalizedAllowedHosts = normalizeAllowedHosts(allowedHosts);
  const safeUrl = getSafeExternalUrl(document.sourceUrl, normalizedAllowedHosts);

  if (!safeUrl) {
    return jsonError("File is unavailable.", 404);
  }

  return fetchExternalFile({
    document,
    url: safeUrl,
    fetchFile,
    allowedHosts: normalizedAllowedHosts
  });
}

export function createPrismaFileProxyStore(prisma: PrismaClient): FileProxyStore {
  return {
    async findOwnedDocumentForProxy(documentId, userId) {
      return prisma.document.findFirst({
        where: {
          id: documentId,
          tender: {
            ownerId: userId
          }
        },
        select: {
          id: true,
          title: true,
          fileName: true,
          status: true,
          sourceUrl: true,
          storageKey: true,
          tender: {
            select: {
              id: true,
              ownerId: true
            }
          }
        }
      });
    }
  };
}
