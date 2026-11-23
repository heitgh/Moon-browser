#!/usr/bin/env bash
set -euo pipefail

: "${LINUX_GPG_PRIVATE_KEY_B64:?Missing Linux signing key}"
: "${LINUX_GPG_FINGERPRINT:?Missing Linux signing fingerprint}"
: "${LINUX_GPG_PASSPHRASE:?Missing Linux signing passphrase}"

export GNUPGHOME="$(mktemp -d)"
chmod 700 "$GNUPGHOME"
trap 'rm -rf "$GNUPGHOME"' EXIT

version=$(node -p "require('./package.json').version")
case "$version" in
  *-alpha.*) channel=alpha ;;
  *-beta.*) channel=beta ;;
  *) channel=latest ;;
esac

printf '%s' "$LINUX_GPG_PRIVATE_KEY_B64" | base64 --decode | gpg --batch --import >/dev/null
gpg --batch --list-secret-keys "$LINUX_GPG_FINGERPRINT" >/dev/null
actual=$(gpg --batch --with-colons --fingerprint "$LINUX_GPG_FINGERPRINT" | awk -F: '$1 == "fpr" { print $10; exit }')
if [[ "$actual" != "${LINUX_GPG_FINGERPRINT^^}" ]]; then echo "Linux signing fingerprint mismatch" >&2; exit 1; fi
gpg --armor --export "$LINUX_GPG_FINGERPRINT" > release/moon-release-public.asc

shopt -s nullglob
packages=(release/*.AppImage release/*.deb release/*.rpm release/*.pacman)
if (( ${#packages[@]} != 4 )); then
  echo "Expected four Linux packages before signing" >&2
  exit 1
fi
for extension in AppImage deb rpm pacman; do
  if [[ ! -s "release/Moon-Browser-${version}-Linux-x64.${extension}" ]]; then
    echo "Missing versioned Linux package: ${extension}" >&2; exit 1
  fi
done
grep -Fx "version: ${version}" "release/${channel}-linux.yml" >/dev/null
node scripts/release/appimage-signature.mjs sign "${packages[0]}" release/moon-update-public.pem "${packages[0]}.sig"
node -e 'const fs=require("node:fs"); const asar=require("@electron/asar"); if(!asar.extractFile("release/linux-unpacked/resources/app.asar", "dist/types/security/moon-update-public.pem").equals(fs.readFileSync("release/moon-update-public.pem"))) throw new Error("AppImage embeds a different update key")'
node scripts/release/appimage-signature.mjs verify "${packages[0]}" release/moon-update-public.pem "${packages[0]}.sig"
files=("${packages[@]}" release/SHA256SUMS-linux.txt release/SBOM.cdx.json "release/${channel}-linux.yml")
for file in "${files[@]}"; do
  if [[ ! -s "$file" ]]; then echo "Missing signing input: $file" >&2; exit 1; fi
  printf '%s' "$LINUX_GPG_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --local-user "$LINUX_GPG_FINGERPRINT" --armor --detach-sign --output "$file.asc" "$file"
  gpg --batch --verify "$file.asc" "$file" >/dev/null
done
