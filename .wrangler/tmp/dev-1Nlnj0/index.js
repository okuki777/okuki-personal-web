var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-VCW4kr/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// shared/netease.js
var PRESET_KEY = "0CoJUm6Qyw8W8jud";
var IV = "0102030405060708";
var BASE = "https://music.163.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
var MODULUS = BigInt(
  "0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7"
);
var PUBLIC_EXPONENT = 65537n;
var enc = new TextEncoder();
function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  return btoa(bin);
}
__name(toBase64, "toBase64");
async function aesEncrypt(text2, key) {
  const ck = await crypto.subtle.importKey("raw", enc.encode(key), { name: "AES-CBC" }, false, ["encrypt"]);
  const buf = await crypto.subtle.encrypt({ name: "AES-CBC", iv: enc.encode(IV) }, ck, enc.encode(text2));
  return toBase64(new Uint8Array(buf));
}
__name(aesEncrypt, "aesEncrypt");
function rsaEncrypt(text2) {
  const reversed = text2.split("").reverse().join("");
  let m = 0n;
  for (let i = 0; i < reversed.length; i++) {
    m = (m << 8n) + BigInt(reversed.charCodeAt(i) & 255);
  }
  let result = 1n;
  let base = m % MODULUS;
  let exp = PUBLIC_EXPONENT;
  while (exp > 0n) {
    if (exp & 1n)
      result = result * base % MODULUS;
    base = base * base % MODULUS;
    exp >>= 1n;
  }
  return result.toString(16).padStart(256, "0");
}
__name(rsaEncrypt, "rsaEncrypt");
function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomSecret, "randomSecret");
async function sign(payload) {
  const text2 = JSON.stringify({ ...payload, csrf_token: "" });
  const secret = randomSecret();
  return {
    params: await aesEncrypt(await aesEncrypt(text2, PRESET_KEY), secret),
    encSecKey: rsaEncrypt(secret)
  };
}
__name(sign, "sign");
async function weapi(path, payload = {}) {
  const { params, encSecKey } = await sign(payload);
  const body = new URLSearchParams({ params, encSecKey });
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Referer": BASE + "/",
      "Origin": BASE,
      "Cookie": "os=pc; appver=2.9.7; osver=; deviceId=netease"
    },
    body: body.toString()
  });
  if (!res.ok)
    throw new Error(`netease HTTP ${res.status}`);
  const json2 = await res.json();
  if (json2 && json2.code && json2.code !== 200) {
    throw new Error(`netease code ${json2.code}${json2.message ? " " + json2.message : ""}`);
  }
  return json2;
}
__name(weapi, "weapi");
function httpsfy(url) {
  if (!url)
    return "";
  return url.replace(/^http:\/\//i, "https://");
}
__name(httpsfy, "httpsfy");
async function fetchUrls(ids, brs = [32e4, 192e3, 128e3]) {
  const map = {};
  let pending = ids.filter(Boolean);
  for (const br of brs) {
    if (!pending.length)
      break;
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100);
      try {
        const d = await weapi("/weapi/song/enhance/player/url", {
          ids: "[" + chunk.join(",") + "]",
          br
        });
        for (const item of d.data || []) {
          if (item && item.id && item.url)
            map[item.id] = httpsfy(item.url);
        }
      } catch (e) {
        console.warn("[netease] url chunk failed:", e.message);
      }
    }
    pending = pending.filter((id) => !map[id]);
  }
  return map;
}
__name(fetchUrls, "fetchUrls");
function toItem(t) {
  const pic = t.al && t.al.picUrl ? httpsfy(t.al.picUrl) + "?param=300y300" : "";
  const ar = t.ar || t.artists || [];
  return {
    id: t.id,
    title: t.name || "",
    author: ar.map((a) => a.name).join(" / "),
    url: "",
    pic,
    lrc: `/api/lyric?id=${t.id}`
  };
}
__name(toItem, "toItem");
async function getPlaylist(id) {
  const d = await weapi("/weapi/v6/playlist/detail", { id: Number(id), n: 1e3, s: 8 });
  let tracks = d.playlist && d.playlist.tracks || [];
  const trackIds = d.playlist && d.playlist.trackIds || [];
  if (tracks.length < trackIds.length) {
    const ids = trackIds.map((t) => t.id).slice(0, 1e3);
    const detail = await weapi("/weapi/v3/song/detail", { c: JSON.stringify(ids.map((i) => ({ id: i }))) });
    if (detail.songs)
      tracks = detail.songs;
  }
  return tracks.map((t) => toItem(t));
}
__name(getPlaylist, "getPlaylist");
async function getSong(id) {
  const d = await weapi("/weapi/v3/song/detail", { c: JSON.stringify([{ id: Number(id) }]) });
  return (d.songs || []).map((t) => toItem(t));
}
__name(getSong, "getSong");
async function getLyric(id) {
  const d = await weapi("/weapi/song/lyric", { id: Number(id), lv: -1, kv: -1, tv: -1 });
  return d.lrc && d.lrc.lyric || "";
}
__name(getLyric, "getLyric");
async function searchSongs(kw, limit = 10) {
  const d = await weapi("/weapi/search/get", { s: kw, type: 1, limit, offset: 0 });
  const songs = d.result && d.result.songs || [];
  return songs.map((s) => ({
    id: s.id,
    title: s.name || "",
    author: (s.artists || []).map((a) => a.name).join(" / "),
    album: s.album ? s.album.name : "",
    duration: s.duration || 0,
    pic: s.album && s.album.picUrl ? httpsfy(s.album.picUrl) + "?param=120y120" : ""
  }));
}
__name(searchSongs, "searchSongs");

// functions/api/[[path]].js
var playlistCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 10 * 60 * 1e3;
var json = /* @__PURE__ */ __name((data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...init.headers || {}
  }
}), "json");
var text = /* @__PURE__ */ __name((body, init = {}) => new Response(body, {
  ...init,
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...init.headers || {}
  }
}), "text");
async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const q = url.searchParams;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, { status: 405 });
  }
  try {
    if (path === "/api/meting") {
      const server = (q.get("server") || "netease").toLowerCase();
      const type = (q.get("type") || "playlist").toLowerCase();
      const id = q.get("id");
      if (!id)
        return json({ error: "missing id" }, { status: 400 });
      if (server !== "netease")
        return json({ error: "only netease is supported" }, { status: 400 });
      if (!["playlist", "song"].includes(type))
        return json({ error: "type must be playlist or song" }, { status: 400 });
      const key = `${type}:${id}`;
      const hit = playlistCache.get(key);
      if (hit && Date.now() - hit.t < CACHE_TTL) {
        return json(hit.v, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60", "X-Cache": "HIT" } });
      }
      const list = type === "playlist" ? await getPlaylist(id) : await getSong(id);
      playlistCache.set(key, { t: Date.now(), v: list });
      return json(list, { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } });
    }
    if (path === "/api/songurl") {
      const id = q.get("id");
      if (!id || !/^\d+$/.test(id))
        return json({ url: "", error: "invalid id" }, { status: 400 });
      const map = await fetchUrls([Number(id)]);
      return json({ url: map[Number(id)] || "" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (path === "/api/lyric") {
      const id = q.get("id");
      if (!id || !/^\d+$/.test(id))
        return text("", { status: 400 });
      const lrc = await getLyric(Number(id));
      return text(lrc, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
    }
    if (path === "/api/search") {
      const kw = (q.get("kw") || q.get("keywords") || "").trim();
      const limit = Math.min(50, Math.max(1, parseInt(q.get("limit") || "10", 10) || 10));
      if (!kw)
        return json({ error: "missing kw" }, { status: 400 });
      const list = await searchSongs(kw, limit);
      return json(list, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    }
    return json({ error: "not found" }, { status: 404 });
  } catch (e) {
    console.error("[api]", path, e);
    return json({ error: String(e && e.message || e) }, { status: 502 });
  }
}
__name(onRequest, "onRequest");

// worker/index.js
var worker_default = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return onRequest({ request, env, ctx, params: {} });
    }
    return env.ASSETS.fetch(request);
  }
};

// C:/Users/okuki/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/okuki/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-VCW4kr/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// C:/Users/okuki/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-VCW4kr/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
