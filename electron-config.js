/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "space.kusyka.app",
  productName: "app",
  artifactName: "${productName}-${os}-${version}.${ext}",
  directories: {
    output: "dist/desktop/${os}",
  },
  mac: {
    target: [
      "zip",
      "dmg",
    ],
    bundleVersion: "1",
  },
  win: {
    publisherName: "kusyka911",
    target: [
      "nsis",
      "portable",
    ],
  },
  nsis: {
    artifactName: "${productName}-${os}-${version}-install.${ext}",
    deleteAppDataOnUninstall: true,
    shortcutName: "app",
    // Include this if you whant to offer your users
    // automatic installation of vc_redist libs.
    // or delete referenced file if you dont need this
    // include: "build/installer.nsh",
    oneClick: true,
  },
  portable: {
    artifactName: "${productName}-${os}-${version}-portable.${ext}",
  },
  linux: {
    target: [
      "deb",
      "appimage",
    ],
  },
  protocols: {
    name: "app",
    schemes: [
      "app",
    ],
  },
  files: [
    "**/*",
    "!**/*.map",
  ],
};
