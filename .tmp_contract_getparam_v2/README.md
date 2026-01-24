# bergerie-site — Fix rid missing on /contract (getParam supports Next.js searchParams object)

## What it fixes
Some Next.js versions pass `searchParams` to `src/app/contract/page.tsx` as a plain object
(e.g. `{ rid: "..." }`) instead of a URLSearchParams. If the page code calls `.get("rid")`,
it returns `undefined` and the UI shows **"Lien invalide : rid manquant."** even though the URL has `?rid=...`.

This patch updates `getParam()` to support:
- URLSearchParams-like objects (with `.get`)
- Plain objects `{ rid: string | string[] }`

It also ensures `/contract` isn't statically cached by adding:
- `export const dynamic = "force-dynamic"`
- `export const revalidate = 0`

## Apply (macOS / Terminal)
1) Put this zip in Downloads.
2) In Terminal:

```bash
cd ~/Documents/SITES/bergerie-site

# clean temp folder
rm -rf .tmp_contract_getparam_v2
mkdir -p .tmp_contract_getparam_v2

# unzip
unzip -o ~/Downloads/bergerie_contract_fix_getparam_v2.zip -d .tmp_contract_getparam_v2

# run patch
python3 .tmp_contract_getparam_v2/scripts/patch_contract_getparam_v2.py

# optional: check build route shows /contract as f (Dynamic)
npm run build
```

3) Then commit + push:

```bash
git add -A
git commit -m "fix: /contract read rid from Next searchParams object"
git push
```

4) Vercel will auto-deploy (or redeploy if needed). Then test:
`https://superbe-bergerie-foret-piscine-lac.com/contract?rid=YOUR_UUID`

You should no longer see "rid manquant".

## Files touched
- src/app/contract/page.tsx (patched in-place, a backup is created next to it)
