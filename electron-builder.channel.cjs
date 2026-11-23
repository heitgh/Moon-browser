/* global process */
const { version } = require("./package.json");
const channel = version.includes("-alpha.") ? "alpha" : version.includes("-beta.") ? "beta" : "latest";
// Legacy alpha builds use the unprefixed feed without signature pinning.
// Signed builds use a separate feed so those builds cannot install future packages through that path.
const releaseChannel = process.env.MOON_RELEASE_SIGNED === "1" ? `signed-${channel}` : channel;

module.exports = {
  extends: "./electron-builder.yml",
  publish: { channel: releaseChannel }
};
