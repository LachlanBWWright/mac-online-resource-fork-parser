type ResourceMap = Record<string, unknown>;

type WorkerRequest =
  | { type: "build-search-index"; data: ResourceMap };

type WorkerResponse =
  | { type: "search-index"; index: Record<string, string> };

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
  }
};
