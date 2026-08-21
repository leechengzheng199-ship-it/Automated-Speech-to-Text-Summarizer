export function describeNetworkError(error: unknown) {
  if (!(error instanceof Error)) return "未知网络错误";

  const cause = "cause" in error ? error.cause : undefined;
  const causeMessage = cause instanceof Error ? cause.message : "";
  const causeCode =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : "";

  if (error.message === "fetch failed") {
    if (causeMessage && causeCode) return `${causeMessage}（${causeCode}）`;
    return causeMessage || "网络请求失败";
  }

  return error.message;
}

export function isNetworkFetchError(error: unknown) {
  return error instanceof Error && error.message === "fetch failed";
}

export function hostFromDomain(domain: string) {
  return domain.trim().replace(/\/+$/, "").replace(/^https?:\/\//i, "");
}

export function isQiniuDefaultCdnHost(host: string) {
  const normalized = host.toLowerCase();
  return (
    normalized.endsWith(".clouddn.com") ||
    normalized.endsWith(".qiniucdn.com") ||
    normalized.endsWith(".qnssl.com")
  );
}

export function downloadProtocols(domain: string): Array<"http" | "https"> {
  const host = hostFromDomain(domain);
  if (isQiniuDefaultCdnHost(host) || /^http:\/\//i.test(domain.trim())) {
    return ["http", "https"];
  }
  return ["https", "http"];
}
