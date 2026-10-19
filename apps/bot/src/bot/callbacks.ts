import { compactDate, compactMonth, expandDate, expandMonth } from "../lib/time.ts";

export type Route =
  | { t: "noop" }
  | { t: "bk.s" }
  | { t: "bk.sp"; svc: number }
  | { t: "bk.m"; svc: number }
  | { t: "bk.mp"; svc: number; mst: number }
  | { t: "bk.c"; svc: number; mst: number; ym: string }
  | { t: "bk.d"; svc: number; mst: number; d: string }
  | { t: "bk.t"; svc: number; mst: number; em: number }
  | { t: "bk.ok"; svc: number; mst: number; em: number }
  | { t: "bk.x" }
  | { t: "rs.c"; id: number; ym: string }
  | { t: "rs.d"; id: number; d: string }
  | { t: "rs.t"; id: number; em: number }
  | { t: "rs.ok"; id: number; em: number }
  | { t: "rs.x" }
  | { t: "my.l"; p: number }
  | { t: "my.v"; id: number }
  | { t: "my.cx"; id: number }
  | { t: "my.cxok"; id: number }
  | { t: "my.rs"; id: number }
  | { t: "hold.pay"; id: number }
  | { t: "hold.rel"; id: number }
  | { t: "set.h" }
  | { t: "set.lang" }
  | { t: "set.langset"; loc: "en" | "ru" }
  | { t: "set.phone" }
  | { t: "set.del" }
  | { t: "set.delok" }
  | { t: "ai.book"; svc: number }
  | { t: "ad.h" }
  | { t: "ad.d"; d: string }
  | { t: "ad.c"; ym: string }
  | { t: "ad.off"; mst: number; d: string }
  | { t: "ad.bk"; id: number }
  | { t: "ad.done"; id: number }
  | { t: "ad.ns"; id: number }
  | { t: "ad.cx"; id: number }
  | { t: "ad.cxok"; id: number }
  | { t: "ad.rf"; id: number }
  | { t: "ad.up"; p: number }
  | { t: "ad.svc" }
  | { t: "ad.sv"; id: number }
  | { t: "ad.svt"; id: number }
  | { t: "ad.svp"; id: number }
  | { t: "ad.svd"; id: number }
  | { t: "ad.svds"; id: number; min: number }
  | { t: "ad.svdep"; id: number }
  | { t: "ad.svdeps"; id: number; pct: number }
  | { t: "ad.svm"; id: number }
  | { t: "ad.svmt"; id: number; mst: number }
  | { t: "ad.sva"; id: number }
  | { t: "ad.svn" }
  | { t: "ad.mst" }
  | { t: "ad.mv"; id: number }
  | { t: "ad.mn"; id: number }
  | { t: "ad.ms"; id: number }
  | { t: "ad.mstg"; id: number; svc: number }
  | { t: "ad.mh"; id: number }
  | { t: "ad.ma"; id: number }
  | { t: "ad.mnw" }
  | { t: "ad.hrs" }
  | { t: "ad.hrm"; mst: number }
  | { t: "ad.hrd"; mst: number; wd: number }
  | { t: "ad.hrp"; mst: number; wd: number; p: number }
  | { t: "ad.hrc"; mst: number; wd: number }
  | { t: "ad.bc" }
  | { t: "ad.st"; per: "7" | "30" | "m" }
  | { t: "ad.ex"; per: "7" | "30" | "m" }
  | { t: "ad.rs" }
  | { t: "ad.rsok" };

function n(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("bad callback int");
  return parsed;
}

export function encode(route: Route): string {
  const parts: string[] = (() => {
    switch (route.t) {
      case "noop":
        return ["noop"];
      case "bk.s":
        return ["bk", "s"];
      case "bk.sp":
        return ["bk", "sp", String(route.svc)];
      case "bk.m":
        return ["bk", "m", String(route.svc)];
      case "bk.mp":
        return ["bk", "mp", String(route.svc), String(route.mst)];
      case "bk.c":
        return ["bk", "c", String(route.svc), String(route.mst), compactMonth(route.ym)];
      case "bk.d":
        return ["bk", "d", String(route.svc), String(route.mst), compactDate(route.d)];
      case "bk.t":
        return ["bk", "t", String(route.svc), String(route.mst), String(route.em)];
      case "bk.ok":
        return ["bk", "ok", String(route.svc), String(route.mst), String(route.em)];
      case "bk.x":
        return ["bk", "x"];
      case "rs.c":
        return ["rs", "c", String(route.id), compactMonth(route.ym)];
      case "rs.d":
        return ["rs", "d", String(route.id), compactDate(route.d)];
      case "rs.t":
        return ["rs", "t", String(route.id), String(route.em)];
      case "rs.ok":
        return ["rs", "ok", String(route.id), String(route.em)];
      case "rs.x":
        return ["rs", "x"];
      case "my.l":
        return ["my", "l", String(route.p)];
      case "my.v":
        return ["my", "v", String(route.id)];
      case "my.cx":
        return ["my", "cx", String(route.id)];
      case "my.cxok":
        return ["my", "cxok", String(route.id)];
      case "my.rs":
        return ["my", "rs", String(route.id)];
      case "hold.pay":
        return ["hold", "pay", String(route.id)];
      case "hold.rel":
        return ["hold", "rel", String(route.id)];
      case "set.h":
        return ["set", "h"];
      case "set.lang":
        return ["set", "lang"];
      case "set.langset":
        return ["set", "langset", route.loc];
      case "set.phone":
        return ["set", "phone"];
      case "set.del":
        return ["set", "del"];
      case "set.delok":
        return ["set", "delok"];
      case "ai.book":
        return ["ai", "book", String(route.svc)];
      case "ad.h":
        return ["ad", "h"];
      case "ad.d":
        return ["ad", "d", compactDate(route.d)];
      case "ad.c":
        return ["ad", "c", compactMonth(route.ym)];
      case "ad.off":
        return ["ad", "off", String(route.mst), compactDate(route.d)];
      case "ad.bk":
        return ["ad", "bk", String(route.id)];
      case "ad.done":
        return ["ad", "done", String(route.id)];
      case "ad.ns":
        return ["ad", "ns", String(route.id)];
      case "ad.cx":
        return ["ad", "cx", String(route.id)];
      case "ad.cxok":
        return ["ad", "cxok", String(route.id)];
      case "ad.rf":
        return ["ad", "rf", String(route.id)];
      case "ad.up":
        return ["ad", "up", String(route.p)];
      case "ad.svc":
        return ["ad", "svc"];
      case "ad.sv":
        return ["ad", "sv", String(route.id)];
      case "ad.svt":
        return ["ad", "svt", String(route.id)];
      case "ad.svp":
        return ["ad", "svp", String(route.id)];
      case "ad.svd":
        return ["ad", "svd", String(route.id)];
      case "ad.svds":
        return ["ad", "svds", String(route.id), String(route.min)];
      case "ad.svdep":
        return ["ad", "svdep", String(route.id)];
      case "ad.svdeps":
        return ["ad", "svdeps", String(route.id), String(route.pct)];
      case "ad.svm":
        return ["ad", "svm", String(route.id)];
      case "ad.svmt":
        return ["ad", "svmt", String(route.id), String(route.mst)];
      case "ad.sva":
        return ["ad", "sva", String(route.id)];
      case "ad.svn":
        return ["ad", "svn"];
      case "ad.mst":
        return ["ad", "mst"];
      case "ad.mv":
        return ["ad", "mv", String(route.id)];
      case "ad.mn":
        return ["ad", "mn", String(route.id)];
      case "ad.ms":
        return ["ad", "ms", String(route.id)];
      case "ad.mstg":
        return ["ad", "mstg", String(route.id), String(route.svc)];
      case "ad.mh":
        return ["ad", "mh", String(route.id)];
      case "ad.ma":
        return ["ad", "ma", String(route.id)];
      case "ad.mnw":
        return ["ad", "mnw"];
      case "ad.hrs":
        return ["ad", "hrs"];
      case "ad.hrm":
        return ["ad", "hrm", String(route.mst)];
      case "ad.hrd":
        return ["ad", "hrd", String(route.mst), String(route.wd)];
      case "ad.hrp":
        return ["ad", "hrp", String(route.mst), String(route.wd), String(route.p)];
      case "ad.hrc":
        return ["ad", "hrc", String(route.mst), String(route.wd)];
      case "ad.bc":
        return ["ad", "bc"];
      case "ad.st":
        return ["ad", "st", route.per];
      case "ad.ex":
        return ["ad", "ex", route.per];
      case "ad.rs":
        return ["ad", "rs"];
      case "ad.rsok":
        return ["ad", "rsok"];
    }
  })();
  const encoded = parts.join(":");
  if (Buffer.byteLength(encoded, "utf8") > 64) {
    throw new Error(`callback data exceeds 64 bytes: ${encoded}`);
  }
  return encoded;
}

export function decode(data: string): Route | null {
  try {
    const p = data.split(":");
    const a = p[0];
    const b = p[1];
    if (a === "noop") return { t: "noop" };
    if (a === "bk") {
      if (b === "s") return { t: "bk.s" };
      if (b === "sp" && p[2]) return { t: "bk.sp", svc: n(p[2]) };
      if (b === "m" && p[2]) return { t: "bk.m", svc: n(p[2]) };
      if (b === "mp" && p[2] && p[3]) return { t: "bk.mp", svc: n(p[2]), mst: n(p[3]) };
      if (b === "c" && p[2] && p[3] && p[4])
        return { t: "bk.c", svc: n(p[2]), mst: n(p[3]), ym: expandMonth(p[4]) };
      if (b === "d" && p[2] && p[3] && p[4])
        return { t: "bk.d", svc: n(p[2]), mst: n(p[3]), d: expandDate(p[4]) };
      if (b === "t" && p[2] && p[3] && p[4])
        return { t: "bk.t", svc: n(p[2]), mst: n(p[3]), em: n(p[4]) };
      if (b === "ok" && p[2] && p[3] && p[4])
        return { t: "bk.ok", svc: n(p[2]), mst: n(p[3]), em: n(p[4]) };
      if (b === "x") return { t: "bk.x" };
    }
    if (a === "rs") {
      if (b === "c" && p[2] && p[3]) return { t: "rs.c", id: n(p[2]), ym: expandMonth(p[3]) };
      if (b === "d" && p[2] && p[3]) return { t: "rs.d", id: n(p[2]), d: expandDate(p[3]) };
      if (b === "t" && p[2] && p[3]) return { t: "rs.t", id: n(p[2]), em: n(p[3]) };
      if (b === "ok" && p[2] && p[3]) return { t: "rs.ok", id: n(p[2]), em: n(p[3]) };
      if (b === "x") return { t: "rs.x" };
    }
    if (a === "my") {
      if (b === "l" && p[2]) return { t: "my.l", p: n(p[2]) };
      if (b === "v" && p[2]) return { t: "my.v", id: n(p[2]) };
      if (b === "cx" && p[2]) return { t: "my.cx", id: n(p[2]) };
      if (b === "cxok" && p[2]) return { t: "my.cxok", id: n(p[2]) };
      if (b === "rs" && p[2]) return { t: "my.rs", id: n(p[2]) };
    }
    if (a === "hold") {
      if (b === "pay" && p[2]) return { t: "hold.pay", id: n(p[2]) };
      if (b === "rel" && p[2]) return { t: "hold.rel", id: n(p[2]) };
    }
    if (a === "set") {
      if (b === "h") return { t: "set.h" };
      if (b === "lang" && !p[2]) return { t: "set.lang" };
      if (b === "langset" && (p[2] === "en" || p[2] === "ru"))
        return { t: "set.langset", loc: p[2] };
      if (b === "phone") return { t: "set.phone" };
      if (b === "del" && !p[2]) return { t: "set.del" };
      if (b === "delok") return { t: "set.delok" };
    }
    if (a === "ai" && b === "book") return { t: "ai.book", svc: p[2] ? n(p[2]) : 0 };
    if (a === "ad") {
      if (b === "h") return { t: "ad.h" };
      if (b === "d" && p[2]) return { t: "ad.d", d: expandDate(p[2]) };
      if (b === "c" && p[2]) return { t: "ad.c", ym: expandMonth(p[2]) };
      if (b === "off" && p[2] && p[3]) return { t: "ad.off", mst: n(p[2]), d: expandDate(p[3]) };
      if (b === "bk" && p[2]) return { t: "ad.bk", id: n(p[2]) };
      if (b === "done" && p[2]) return { t: "ad.done", id: n(p[2]) };
      if (b === "ns" && p[2]) return { t: "ad.ns", id: n(p[2]) };
      if (b === "cx" && p[2] && !p[3]) return { t: "ad.cx", id: n(p[2]) };
      if (b === "cxok" && p[2]) return { t: "ad.cxok", id: n(p[2]) };
      if (b === "rf" && p[2]) return { t: "ad.rf", id: n(p[2]) };
      if (b === "up" && p[2]) return { t: "ad.up", p: n(p[2]) };
      if (b === "svc") return { t: "ad.svc" };
      if (b === "sv" && p[2]) return { t: "ad.sv", id: n(p[2]) };
      if (b === "svt" && p[2]) return { t: "ad.svt", id: n(p[2]) };
      if (b === "svp" && p[2]) return { t: "ad.svp", id: n(p[2]) };
      if (b === "svd" && p[2] && !p[3]) return { t: "ad.svd", id: n(p[2]) };
      if (b === "svds" && p[2] && p[3]) return { t: "ad.svds", id: n(p[2]), min: n(p[3]) };
      if (b === "svdep" && p[2] && !p[3]) return { t: "ad.svdep", id: n(p[2]) };
      if (b === "svdeps" && p[2] && p[3]) return { t: "ad.svdeps", id: n(p[2]), pct: n(p[3]) };
      if (b === "svm" && p[2] && !p[3]) return { t: "ad.svm", id: n(p[2]) };
      if (b === "svmt" && p[2] && p[3]) return { t: "ad.svmt", id: n(p[2]), mst: n(p[3]) };
      if (b === "sva" && p[2]) return { t: "ad.sva", id: n(p[2]) };
      if (b === "svn") return { t: "ad.svn" };
      if (b === "mst") return { t: "ad.mst" };
      if (b === "mv" && p[2]) return { t: "ad.mv", id: n(p[2]) };
      if (b === "mn" && p[2]) return { t: "ad.mn", id: n(p[2]) };
      if (b === "ms" && p[2]) return { t: "ad.ms", id: n(p[2]) };
      if (b === "mstg" && p[2] && p[3]) return { t: "ad.mstg", id: n(p[2]), svc: n(p[3]) };
      if (b === "mh" && p[2]) return { t: "ad.mh", id: n(p[2]) };
      if (b === "ma" && p[2]) return { t: "ad.ma", id: n(p[2]) };
      if (b === "mnw") return { t: "ad.mnw" };
      if (b === "hrs") return { t: "ad.hrs" };
      if (b === "hrm" && p[2]) return { t: "ad.hrm", mst: n(p[2]) };
      if (b === "hrd" && p[2] && p[3]) return { t: "ad.hrd", mst: n(p[2]), wd: n(p[3]) };
      if (b === "hrp" && p[2] && p[3] && p[4])
        return { t: "ad.hrp", mst: n(p[2]), wd: n(p[3]), p: n(p[4]) };
      if (b === "hrc" && p[2] && p[3]) return { t: "ad.hrc", mst: n(p[2]), wd: n(p[3]) };
      if (b === "bc") return { t: "ad.bc" };
      if (b === "st" && (p[2] === "7" || p[2] === "30" || p[2] === "m"))
        return { t: "ad.st", per: p[2] };
      if (b === "ex" && (p[2] === "7" || p[2] === "30" || p[2] === "m"))
        return { t: "ad.ex", per: p[2] };
      if (b === "rs" && !p[2]) return { t: "ad.rs" };
      if (b === "rsok") return { t: "ad.rsok" };
    }
    return null;
  } catch {
    return null;
  }
}

export function cb(route: Route): string {
  return encode(route);
}
