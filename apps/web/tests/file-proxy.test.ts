import test from "node:test";
import assert from "node:assert/strict";
import {
  proxyDocumentFileForUser,
  type FileProxyDocumentRecord,
  type FileProxyStore
} from "../src/documents/file-proxy";

class FileProxyStoreFake implements FileProxyStore {
  readonly documents = new Map<string, FileProxyDocumentRecord>();
  lastLookup: { documentId: string; userId: string } | null = null;

  async findOwnedDocumentForProxy(documentId: string, userId: string) {
    this.lastLookup = {
      documentId,
      userId
    };

    const document = this.documents.get(documentId);

    if (!document || document.tender.ownerId !== userId) {
      return null;
    }

    return document;
  }

  add(overrides: Partial<FileProxyDocumentRecord> = {}) {
    const document: FileProxyDocumentRecord = {
      id: "doc-1",
      title: "Documentation",
      fileName: "documentation.pdf",
      status: "AVAILABLE",
      sourceUrl: "https://files.example.test/documentation.pdf?token=secret",
      storageKey: null,
      tender: {
        id: "tender-1",
        ownerId: "user-1"
      },
      ...overrides
    };

    this.documents.set(document.id, document);
    return document;
  }
}

function createFetchRecorder() {
  const calls: string[] = [];
  const redirectModes: Array<RequestRedirect | undefined> = [];
  const fetchFile: typeof fetch = async (input, init) => {
    calls.push(String(input));
    redirectModes.push(init?.redirect);

    return new Response("pdf-bytes", {
      status: 200,
      headers: {
        "content-length": "9",
        "content-type": "application/pdf"
      }
    });
  };

  return {
    calls,
    redirectModes,
    fetchFile
  };
}

function createRedirectFetch(
  responses: Array<
    | {
        status: 301 | 302 | 303 | 307 | 308;
        location: string;
      }
    | {
        status: 200;
        body?: string;
      }
  >
) {
  const calls: string[] = [];
  const redirectModes: Array<RequestRedirect | undefined> = [];
  const fetchFile: typeof fetch = async (input, init) => {
    calls.push(String(input));
    redirectModes.push(init?.redirect);
    const response = responses.shift();

    if (!response) {
      throw new Error("Unexpected fetch call.");
    }

    if (response.status === 200) {
      return new Response(response.body ?? "pdf-bytes", {
        status: 200,
        headers: {
          "content-length": String(response.body?.length ?? "pdf-bytes".length),
          "content-type": "application/pdf"
        }
      });
    }

    return new Response(null, {
      status: response.status,
      headers: {
        location: response.location
      }
    });
  };

  return {
    calls,
    redirectModes,
    fetchFile
  };
}

test("file proxy serves an owned allowlisted URL without redirect and without exposing the source URL", async () => {
  const store = new FileProxyStoreFake();
  store.add();
  const fetchRecorder = createFetchRecorder();

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "pdf-bytes");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition") ?? "", /documentation\.pdf/);
  assert.equal(JSON.stringify([...response.headers]).includes("secret"), false);
  assert.deepEqual(fetchRecorder.calls, [
    "https://files.example.test/documentation.pdf?token=secret"
  ]);
  assert.deepEqual(fetchRecorder.redirectModes, ["manual"]);
});

test("file proxy follows allowlisted redirects manually", async () => {
  const store = new FileProxyStoreFake();
  store.add();
  const fetchRecorder = createRedirectFetch([
    {
      status: 302,
      location: "/redirected/documentation.pdf?token=next-secret"
    },
    {
      status: 200,
      body: "redirected-pdf"
    }
  ]);

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "redirected-pdf");
  assert.deepEqual(fetchRecorder.calls, [
    "https://files.example.test/documentation.pdf?token=secret",
    "https://files.example.test/redirected/documentation.pdf?token=next-secret"
  ]);
  assert.deepEqual(fetchRecorder.redirectModes, ["manual", "manual"]);
});

test("user cannot access another user's document through file proxy", async () => {
  const store = new FileProxyStoreFake();
  store.add({
    id: "foreign-doc",
    tender: {
      id: "foreign-tender",
      ownerId: "user-2"
    }
  });
  const fetchRecorder = createFetchRecorder();

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "foreign-doc",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });

  assert.equal(response.status, 404);
  assert.equal(fetchRecorder.calls.length, 0);
});

test("file proxy returns 404 for a missing document", async () => {
  const store = new FileProxyStoreFake();
  const fetchRecorder = createFetchRecorder();

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "missing-doc",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });

  assert.equal(response.status, 404);
  assert.equal(fetchRecorder.calls.length, 0);
});

test("file proxy does not accept an arbitrary URL as the document id", async () => {
  const store = new FileProxyStoreFake();
  const fetchRecorder = createFetchRecorder();

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "https://files.example.test/secret.pdf",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });

  assert.equal(response.status, 404);
  assert.equal(store.lastLookup, null);
  assert.equal(fetchRecorder.calls.length, 0);
});

test("file proxy rejects untrusted persisted source URLs safely", async () => {
  const store = new FileProxyStoreFake();
  store.add({
    sourceUrl: "https://evil.example/secret.pdf?token=secret"
  });
  const fetchRecorder = createFetchRecorder();

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.equal(fetchRecorder.calls.length, 0);
  assert.equal(body.includes("evil.example"), false);
  assert.equal(body.includes("secret"), false);
});

test("file proxy blocks allowlisted redirects to unallowlisted hosts without returning upstream body", async () => {
  const store = new FileProxyStoreFake();
  store.add();
  const fetchRecorder = createRedirectFetch([
    {
      status: 302,
      location: "https://evil.example/secret.pdf?token=redirect-secret"
    },
    {
      status: 200,
      body: "must-not-return"
    }
  ]);

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });
  const body = await response.text();

  assert.equal(response.status, 403);
  assert.deepEqual(fetchRecorder.calls, [
    "https://files.example.test/documentation.pdf?token=secret"
  ]);
  assert.equal(body.includes("evil.example"), false);
  assert.equal(body.includes("redirect-secret"), false);
  assert.equal(body.includes("must-not-return"), false);
});

test("file proxy blocks redirect chains after the redirect limit", async () => {
  const store = new FileProxyStoreFake();
  store.add();
  const fetchRecorder = createRedirectFetch([
    { status: 302, location: "/r1.pdf" },
    { status: 302, location: "/r2.pdf" },
    { status: 302, location: "/r3.pdf" },
    { status: 302, location: "/r4.pdf" },
    { status: 200, body: "must-not-return" }
  ]);

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });
  const body = await response.text();

  assert.equal(response.status, 502);
  assert.deepEqual(fetchRecorder.calls, [
    "https://files.example.test/documentation.pdf?token=secret",
    "https://files.example.test/r1.pdf",
    "https://files.example.test/r2.pdf",
    "https://files.example.test/r3.pdf"
  ]);
  assert.equal(body.includes("must-not-return"), false);
});

test("file proxy blocks non-http redirect locations", async () => {
  const store = new FileProxyStoreFake();
  store.add();
  const fetchRecorder = createRedirectFetch([
    {
      status: 302,
      location: "javascript:alert('secret')"
    },
    {
      status: 200,
      body: "must-not-return"
    }
  ]);

  const response = await proxyDocumentFileForUser({
    store,
    userId: "user-1",
    documentId: "doc-1",
    fetchFile: fetchRecorder.fetchFile,
    allowedHosts: ["files.example.test"],
    storageRoot: null
  });
  const body = await response.text();

  assert.equal(response.status, 403);
  assert.deepEqual(fetchRecorder.calls, [
    "https://files.example.test/documentation.pdf?token=secret"
  ]);
  assert.equal(body.includes("javascript:"), false);
  assert.equal(body.includes("secret"), false);
  assert.equal(body.includes("must-not-return"), false);
});
