/* global process */
const publisherName = process.env.MOON_WINDOWS_PUBLISHER_NAME;
if (!publisherName) throw new Error("Signed Windows release requires MOON_WINDOWS_PUBLISHER_NAME");

module.exports = {
  extends: "./electron-builder.channel.cjs",
  win: {
    publisherName,
    forceCodeSigning: true
  }
};
