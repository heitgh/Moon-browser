const { version } = require("./package.json");
const channel = version.includes("-alpha.") ? "alpha" : version.includes("-beta.") ? "beta" : "latest";

module.exports = {
  extends: "./electron-builder.yml",
  publish: { channel }
};
