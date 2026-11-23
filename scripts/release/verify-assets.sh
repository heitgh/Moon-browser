#!/usr/bin/env bash
set -euo pipefail

: "${LINUX_GPG_FINGERPRINT:?Missing Linux signing fingerprint}"
export GNUPGHOME="$(mktemp -d)"
chmod 700 "$GNUPGHOME"
trap 'rm -rf "$GNUPGHOME"' EXIT
version=$(node -p "require('./package.json').version")
case "$version" in
  *-alpha.*) channel=alpha ;;
  *-beta.*) channel=beta ;;
  *) channel=latest ;;
esac
for legacy in "release/${channel}.yml" "release/${channel}-linux.yml"; do
  if [[ -e "$legacy" ]]; then echo "Legacy update metadata must not be published: $legacy" >&2; exit 1; fi
done

shopt -s nullglob
packages=(release/*.AppImage release/*.deb release/*.rpm release/*.pacman)
windows=(release/*.exe)
if (( ${#packages[@]} != 4 || ${#windows[@]} != 2 )); then
  echo "Expected four Linux and two Windows installers" >&2
  exit 1
fi
for extension in AppImage deb rpm pacman; do
  if [[ ! -s "release/Moon-Browser-${version}-Linux-x64.${extension}" ]]; then
    echo "Missing versioned Linux package: ${extension}" >&2; exit 1
  fi
done
for suffix in Setup Portable; do
  if [[ ! -s "release/Moon-Browser-${version}-Windows-x64-${suffix}.exe" ]]; then
    echo "Missing versioned Windows package: ${suffix}" >&2; exit 1
  fi
done
for file in release/SHA256SUMS-linux.txt release/SHA256SUMS-windows.txt release/SBOM.cdx.json \
  "release/signed-${channel}.yml" "release/signed-${channel}-linux.yml" release/moon-release-public.asc release/moon-update-public.pem "${packages[0]}.sig"; do
  if [[ ! -s "$file" ]]; then echo "Missing release asset: $file" >&2; exit 1; fi
done
grep -Fx "version: ${version}" "release/signed-${channel}.yml" >/dev/null
grep -Fx "version: ${version}" "release/signed-${channel}-linux.yml" >/dev/null
node scripts/release/appimage-signature.mjs verify "${packages[0]}" release/moon-update-public.pem "${packages[0]}.sig"
gpg --batch --import release/moon-release-public.asc >/dev/null
gpg --batch --list-keys "$LINUX_GPG_FINGERPRINT" >/dev/null
actual=$(gpg --batch --with-colons --fingerprint "$LINUX_GPG_FINGERPRINT" | awk -F: '$1 == "fpr" { print $10; exit }')
if [[ "$actual" != "${LINUX_GPG_FINGERPRINT^^}" ]]; then echo "Linux release fingerprint mismatch" >&2; exit 1; fi
for file in "${packages[@]}" release/SHA256SUMS-linux.txt release/SBOM.cdx.json "release/signed-${channel}-linux.yml"; do
  gpg --batch --verify "$file.asc" "$file" >/dev/null
done
(
  cd release
  sha256sum --check SHA256SUMS-linux.txt
  sha256sum --check SHA256SUMS-windows.txt
)
node -e 'const bom=require("./release/SBOM.cdx.json"); if(bom.bomFormat!=="CycloneDX" || !Array.isArray(bom.components) || !bom.components.length) process.exit(1)'
