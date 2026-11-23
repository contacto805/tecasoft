export function lotPublicPath(token) {
  return "/lot/" + encodeURIComponent(token);
}

export function lotPublicUrl(token, origin) {
  const configured = process.env.NEXT_PUBLIC_LOT_PORTAL_URL;
  return new URL(lotPublicPath(token), configured || origin).href;
}
