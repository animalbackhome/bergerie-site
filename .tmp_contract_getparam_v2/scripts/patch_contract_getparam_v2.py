#!/usr/bin/env python3
import re
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path.cwd()
TARGET = REPO_ROOT / "src/app/contract/page.tsx"

def fail(msg: str):
    raise SystemExit(f"❌ {msg}")

if not TARGET.exists():
    fail(f"Fichier introuvable: {TARGET}")

src = TARGET.read_text(encoding="utf-8")

backup = TARGET.with_suffix(f".tsx.backup-{datetime.now().strftime('%Y-%m-%dT%H-%M-%S')}")
backup.write_text(src, encoding="utf-8")

changed = False

# 1) Ensure dynamic mode to avoid query being ignored by static caching
if 'export const dynamic' not in src:
    # insert after last import block
    m = re.search(r'^(import[^\n]*\n)+', src, flags=re.M)
    insert_at = m.end() if m else 0
    injection = 'export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n'
    src = src[:insert_at] + injection + src[insert_at:]
    changed = True

# 2) Patch getParam() to support URLSearchParams-like and plain object searchParams
getparam_pattern = re.compile(r'function\s+getParam\s*\([\s\S]*?\n\}', re.M)

new_getparam = """function getParam(searchParams: any, key: string): string | undefined {
  if (!searchParams) return undefined;

  // If a Promise was passed (some Next.js typings), we can't synchronously read it.
  if (typeof (searchParams as any)?.then === "function") return undefined;

  // URLSearchParams-like
  if (typeof (searchParams as any)?.get === "function") {
    const v = (searchParams as any).get(key);
    return typeof v === "string" ? v : undefined;
  }

  // Plain object (Next.js App Router): Record<string, string | string[]>
  const raw = (searchParams as any)[key];
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : undefined;
  return typeof raw === "string" ? raw : undefined;
}"""

if getparam_pattern.search(src):
    src2 = getparam_pattern.sub(new_getparam, src, count=1)
    if src2 != src:
        src = src2
        changed = True
else:
    # If no getParam exists, try to patch rid extraction line directly (fallback).
    # We'll just insert getParam right before normalizeRid() or near top.
    m_norm = re.search(r'function\s+normalizeRid\s*\(', src)
    if not m_norm:
        fail("Impossible de trouver getParam() ou normalizeRid() pour injecter le helper.")
    insert_at = m_norm.start()
    src = src[:insert_at] + new_getparam + "\n\n" + src[insert_at:]
    changed = True

# 3) If rid extraction uses `.get(...)` directly, replace it to use getParam() consistently.
src_before = src
src = re.sub(
    r'const\s+rid\s*=\s*normalizeRid\(\s*([^)]+)\.get\(\s*["\']rid["\']\s*\)\s*\)\s*;',
    r'const rid = normalizeRid(getParam(\1, "rid"));',
    src
)
if src != src_before:
    changed = True

if not changed:
    print("ℹ️ Aucun changement nécessaire (déjà patché ?).")
else:
    TARGET.write_text(src, encoding="utf-8")
    print(f"✅ Patch appliqué: {TARGET}")
    print(f"🧷 Backup créé: {backup}")
