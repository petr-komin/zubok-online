#!/usr/bin/env bash
#
# deploy.sh — sestaví SPA a nahraje ji přes rsync/ssh na server s nginxem.
#
#   ./deploy.sh              sestaví a nasadí
#   ./deploy.sh --dry-run    ukáže, co by se přeneslo, ale nic nezapíše
#   ./deploy.sh --no-build   nasadí už existující client/dist
#
# Nastavení se čte z deploy.conf (vzor viz deploy.conf.example).
# Proměnné jde přebít z prostředí: SSH_HOST=jiny.server ./deploy.sh

set -euo pipefail

KORENA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$KORENA"

DIST="client/dist"
DRY_RUN=0
BUILD=1

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=1 ;;
    --no-build) BUILD=0 ;;
    -h|--help)  sed -n '2,10p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Neznámý přepínač: $arg" >&2; exit 2 ;;
  esac
done

# ── Konfigurace ───────────────────────────────────────────────────
if [[ -f deploy.conf ]]; then
  # shellcheck disable=SC1091
  source deploy.conf
elif [[ -z "${SSH_HOST:-}" ]]; then
  echo "Chybí deploy.conf." >&2
  echo "Vytvoř ho ze vzoru:  cp deploy.conf.example deploy.conf" >&2
  exit 1
fi

: "${SSH_HOST:?SSH_HOST není nastaven}"
: "${SSH_USER:?SSH_USER není nastaven}"
: "${REMOTE_DIR:?REMOTE_DIR není nastaven}"

# Pojistka proti překlepu v cestě — rsync --delete na špatném místě
# by smazal cizí soubory.
case "$REMOTE_DIR" in
  /|/root|/home|/etc|/usr|/var|/var/www|"")
    echo "REMOTE_DIR='$REMOTE_DIR' je nebezpečně obecná cesta, odmítám." >&2
    exit 1 ;;
  /*) ;;
  *)  echo "REMOTE_DIR musí být absolutní cesta, je '$REMOTE_DIR'." >&2; exit 1 ;;
esac

SSH_OPTS=(-o BatchMode=yes)
[[ -n "${SSH_PORT:-}" ]] && SSH_OPTS+=(-p "$SSH_PORT")
[[ -n "${SSH_KEY:-}"  ]] && SSH_OPTS+=(-i "${SSH_KEY/#\~/$HOME}")
CIL="${SSH_USER}@${SSH_HOST}"

# ── Sestavení ─────────────────────────────────────────────────────
if [[ $BUILD -eq 1 ]]; then
  echo "▸ Sestavuji…"
  npm run build --prefix client
else
  echo "▸ Build přeskočen (--no-build)"
fi

[[ -f "$DIST/index.html" ]] || { echo "V $DIST není index.html — build neproběhl?" >&2; exit 1; }

# ── Spojení ───────────────────────────────────────────────────────
echo "▸ Ověřuji SSH na ${CIL}…"
if ! ssh "${SSH_OPTS[@]}" "$CIL" true 2>/dev/null; then
  echo "SSH spojení na ${CIL} selhalo." >&2
  echo "Zkontroluj klíč (BatchMode nedovolí heslo) a dostupnost serveru." >&2
  exit 1
fi

ssh "${SSH_OPTS[@]}" "$CIL" "mkdir -p '$REMOTE_DIR'"

RSYNC=(rsync -rlpt --human-readable --chmod=D755,F644)
RSYNC+=(-e "ssh ${SSH_OPTS[*]}")
[[ $DRY_RUN -eq 1 ]] && RSYNC+=(--dry-run --verbose)

# ── Přenos ────────────────────────────────────────────────────────
# Dva průchody: nejdřív aktiva (index.html zatím na ně neodkazuje),
# teprve pak index.html a úklid starých souborů. Prohlížeč, který si
# stránku načte uprostřed nasazení, tak nikdy nenarazí na chybějící JS.
echo "▸ Nahrávám aktiva…"
"${RSYNC[@]}" --exclude=index.html "$DIST/" "${CIL}:${REMOTE_DIR}/"

echo "▸ Nahrávám index.html a uklízím staré soubory…"
"${RSYNC[@]}" --delete-after "$DIST/" "${CIL}:${REMOTE_DIR}/"

# ── Vlastník ──────────────────────────────────────────────────────
if [[ -n "${REMOTE_OWNER:-}" && $DRY_RUN -eq 0 ]]; then
  echo "▸ Nastavuji vlastníka na $REMOTE_OWNER…"
  ssh "${SSH_OPTS[@]}" "$CIL" "sudo chown -R '$REMOTE_OWNER' '$REMOTE_DIR'"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "▸ Zkouška nanečisto — na serveru se nic nezměnilo."
else
  echo "▸ Hotovo: ${CIL}:${REMOTE_DIR}"
fi
