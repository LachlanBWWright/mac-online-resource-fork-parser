type ResourceMap = Record<string, unknown>;

type WorkerRequest =
  | { type: "build-search-index"; data: ResourceMap }
  | { type: "stringify"; requestId: number; value: unknown };

type WorkerResponse =
  | { type: "search-index"; index: Record<string, string> }
  | { type: "stringified"; requestId: number; value: string | null };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  const request = event.data;

  if (request.type === "build-search-index") {
    const index: Record<string, string> = {};
    Object.entries(request.data).forEach(([fourCC, resources]) => {
      if (!resources || typeof resources !== "object") return;
      Object.entries(resources as Record<string, unknown>).forEach(([resourceId, resource]) => {
        index[`${fourCC}-${resourceId}`] = `${resourceId} ${JSON.stringify(resource)}`.toLowerCase();
      });
    });
    workerScope.postMessage({ type: "search-index", index });
    return;
  }

  let value: string | null = null;
  try {
    value = JSON.stringify(request.value, null, 2) ?? null;
  } catch {
    value = null;
  }
  workerScope.postMessage({ type: "stringified", requestId: request.requestId, value });
};
