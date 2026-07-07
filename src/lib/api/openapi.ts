// Minimal OpenAPI 3 / Swagger 2 reader. We don't need a full validator — just a
// compact, token-cheap summary of endpoints for the planner model to work from.

export interface EndpointSummary {
  method: string;
  path: string;
  summary?: string;
  params?: string; // "query: status(required), path: id"
  requestFields?: string; // top-level request body field names
  security?: boolean;
}

export interface SpecSummary {
  title?: string;
  baseUrl?: string;
  endpoints: EndpointSummary[];
}

export async function loadSpec(specUrlOrJson: string): Promise<any> {
  const s = specUrlOrJson.trim();
  if (s.startsWith("{")) return JSON.parse(s);
  const res = await fetch(s, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`spec fetch ${res.status}`);
  const text = await res.text();
  return JSON.parse(text);
}

function schemaFields(schema: any, spec: any, depth = 0): string {
  if (!schema || depth > 2) return "";
  if (schema.$ref) schema = resolveRef(spec, schema.$ref);
  if (schema?.properties) return Object.keys(schema.properties).slice(0, 12).join(", ");
  if (schema?.items) return "[]" + schemaFields(schema.items, spec, depth + 1);
  return "";
}

function resolveRef(spec: any, ref: string): any {
  if (!ref?.startsWith("#/")) return {};
  return ref
    .slice(2)
    .split("/")
    .reduce((acc, k) => (acc ? acc[k.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined), spec) || {};
}

export function summarizeSpec(spec: any, fallbackBase?: string): SpecSummary {
  const endpoints: EndpointSummary[] = [];
  const paths = spec?.paths || {};
  const methods = ["get", "post", "put", "patch", "delete"];

  for (const [path, item] of Object.entries<any>(paths)) {
    for (const m of methods) {
      const op = item?.[m];
      if (!op) continue;
      const params = (op.parameters || item.parameters || [])
        .map((p: any) => {
          if (p.$ref) p = resolveRef(spec, p.$ref);
          return `${p.in}:${p.name}${p.required ? "(req)" : ""}`;
        })
        .join(", ");
      let requestFields = "";
      const rb = op.requestBody;
      if (rb) {
        const media = rb.content?.["application/json"] || rb.content?.[Object.keys(rb.content || {})[0]];
        if (media?.schema) requestFields = schemaFields(media.schema, spec);
      }
      endpoints.push({
        method: m.toUpperCase(),
        path,
        summary: op.summary || op.operationId,
        params: params || undefined,
        requestFields: requestFields || undefined,
        security: !!(op.security || spec.security),
      });
    }
  }

  // base url — OpenAPI 3 servers[] or Swagger 2 host+basePath
  let baseUrl: string | undefined;
  if (Array.isArray(spec?.servers) && spec.servers[0]?.url) {
    baseUrl = spec.servers[0].url;
  } else if (spec?.host) {
    const scheme = (spec.schemes && spec.schemes[0]) || "https";
    baseUrl = `${scheme}://${spec.host}${spec.basePath || ""}`;
  }
  // resolve protocol-relative or relative server urls against the spec url
  if (baseUrl && baseUrl.startsWith("/") && fallbackBase) {
    try {
      baseUrl = new URL(baseUrl, fallbackBase).toString();
    } catch {
      /* ignore */
    }
  }

  return { title: spec?.info?.title, baseUrl, endpoints: endpoints.slice(0, 40) };
}

export function endpointsToPrompt(eps: EndpointSummary[]): string {
  return eps
    .map(
      (e) =>
        `${e.method} ${e.path}${e.summary ? ` — ${e.summary}` : ""}${e.params ? ` [${e.params}]` : ""}${e.requestFields ? ` {body: ${e.requestFields}}` : ""}${e.security ? " (auth)" : ""}`
    )
    .join("\n");
}
