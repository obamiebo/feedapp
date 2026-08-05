function publicAppOrigin() {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  const url = new URL(configuredUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("PUBLIC_APP_URL must use http or https");
  }

  return url.origin;
}

export function appUrl(path: string, requestUrl: string | URL) {
  return new URL(path, publicAppOrigin() ?? requestUrl);
}

export function appRedirectLocation(path: string) {
  const origin = publicAppOrigin();
  return origin ? new URL(path, origin).toString() : path;
}
