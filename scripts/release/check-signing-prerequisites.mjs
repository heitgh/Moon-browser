/* global process, console */
const prerequisites = {
  win32: [
    ["CSC_LINK", "WINDOWS_CSC_LINK"],
    ["CSC_KEY_PASSWORD", "WINDOWS_CSC_KEY_PASSWORD"],
    ["MOON_WINDOWS_PUBLISHER_NAME", "WINDOWS_PUBLISHER_NAME"]
  ],
  linux: [
    ["LINUX_UPDATE_SIGNING_KEY_B64", "LINUX_UPDATE_SIGNING_KEY_B64"],
    ["LINUX_GPG_PRIVATE_KEY_B64", "LINUX_GPG_PRIVATE_KEY_B64"],
    ["LINUX_GPG_FINGERPRINT", "LINUX_GPG_FINGERPRINT"],
    ["LINUX_GPG_PASSPHRASE", "LINUX_GPG_PASSPHRASE"]
  ]
};

const required = Object.hasOwn(prerequisites, process.argv[2]) ? prerequisites[process.argv[2]] : undefined;
if (!required) {
  console.error("Expected signing platform: win32 or linux");
  process.exitCode = 2;
} else {
  const missing = required.filter(([environmentName]) => !process.env[environmentName]?.trim()).map(([, secretName]) => secretName);
  if (missing.length) {
    console.error(`Missing repository signing secrets: ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}
