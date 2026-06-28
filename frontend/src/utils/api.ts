const API_BASE = (import.meta.env.VITE_API_URL as string) || "";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  
  const newInit: RequestInit = init ? { ...init } : {};

  // Check if it is a relative /api route (excluding login)
  if (url.startsWith("/api/") && !url.includes("/api/auth/login")) {
    const activeToken = localStorage.getItem("mandimate_token");
    const activeLang = localStorage.getItem("mandimate_lang") || "en";
    const headers = new Headers(newInit.headers);
    if (activeToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${activeToken}`);
    }
    if (!headers.has("X-App-Language")) {
      headers.set("X-App-Language", activeLang);
    }
    newInit.headers = headers;
  }

  const finalInput = url.startsWith("/api/") ? `${API_BASE}${url}` : input;
  const response = await window.fetch(finalInput, newInit);

  // Auto logout on 401 unauthorized
  if (response.status === 401 && url.startsWith("/api/") && !url.includes("/api/auth/login")) {
    console.warn("Unauthorized API call. Logging out...");
    localStorage.removeItem("mandimate_token");
    localStorage.removeItem("mandimate_user");
    window.location.reload();
  }

  return response;
}
