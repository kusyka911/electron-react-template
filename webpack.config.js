/* eslint-disable no-unused-vars */
const { resolve } = require("path");

const pick = require("lodash/pick");
const detectPort = require("detect-port-alt");


const { DefinePlugin, EnvironmentPlugin, HotModuleReplacementPlugin } = require("webpack");
const { merge } = require("webpack-merge");

const ESLintPlugin = require("eslint-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const PnpWebpackPlugin = require("pnp-webpack-plugin");
const HooksPlugin = require("hooks-webpack-plugin");
const DotEnvPlugin = require("dotenv-webpack");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const postcssNormalize = require("postcss-normalize");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");
const ModuleNotFoundPlugin = require("react-dev-utils/ModuleNotFoundPlugin");
const WatchMissingNodeModulesPlugin = require("react-dev-utils/WatchMissingNodeModulesPlugin");
const ManifestPlugin = require("webpack-manifest-plugin");

const nodeExternals = require("webpack-node-externals");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const CspHtmlWebpackPlugin = require("csp-html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const NodemonPlugin = require("nodemon-webpack-plugin");

// Declare all project paths
const appRoot = __dirname;
const appSrc = resolve(appRoot, "src");
const appBuild = resolve(appRoot, "build");
const appDist = resolve(appRoot, "dist");

const paths = {
  appRoot,
  appSrc,
  appPkg: resolve(appRoot, "package.json"),
  appStatic: resolve(appRoot, "static"),
  appHtml: resolve(appRoot, "static", "index.html"),
  appConfigDir: resolve(appRoot, "config"),
  appNodeModules: resolve(appRoot, "node_modules"),
  web: {
    entry: {
      index: resolve(appSrc, "main"),
    },
    output: {
      path: resolve(appDist, "web"),
      filename: "[name].js",
    },
  },
  electron: {
    builderConfig: resolve(appRoot, "electron-config.js"),
    main: {
      entry: {
        main:  resolve(appSrc, "electron", "main"),
      },
      output: {
        path: resolve(appRoot, "app"),
        filename: "[name].js",
        libraryTarget: "commonjs2",
      },
    },
    preload: {
      entry: {
        main: resolve(appSrc, "electron", "preload"),
      },
      output: {
        path: resolve(appRoot, "app", "preload"),
        filename: "[name].js",
        // TODO: Find way to make scoped CORE variable fo web.
        library: "CORE",
        libraryTarget: "window",
      },
    },
    renderer: {
      entry: {
        index: resolve(appSrc, "main"),
      },
      output: {
        path: resolve(appRoot, "app", "ui"),
        filename: "[name].js",
        libraryTarget: "",
      },
      // We make wds output path to electron bundle root to avoid problems with index path for UI
      // in development mode it would not be written on disk.
      wdsOutput: {
        path: resolve(appRoot, "app"),
        filename: "[name].js",
        libraryTarget: "umd",
      },
    },
  },
};

const packageJson = require(paths.appPkg);

process.env["NODE_CONFIG_DIR"] = paths.appConfigDir;

// Content-Security-Policy configuration
// TODO: make inline styles forbidden
const csp = {
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  // Need to allow unsafe-inline for development
  // TODO: find way to avoid this.
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
};

if (!Array.prototype.contains) {
  Array.prototype.contains = function (el) {
    return this.indexOf(el) !== -1;
  };
}

module.exports = configureWebpack;

// TODO?: Add react-native support?

/**
 * @param {Array<string> | string} webpackEnv
 * @returns {Promise<import("webpack").Configuration>}
 */
async function configureWebpack(webpackEnv) {
  // Make environment array
  const isEnvArray = Array.isArray(webpackEnv);
  if (!isEnvArray) webpackEnv = [webpackEnv];

  // Detect WDS
  const isWds = process.env.WEBPACK_DEV_SERVER === "true";

  // Prod/dev environment
  const isEnvDevelopment = !webpackEnv.contains("production") && isWds;
  const isEnvProduction = webpackEnv.contains("production");

  // Build all platforms
  const isTargetAll = webpackEnv.contains("build");

  // Electron/web/build environment
  const isTargetWeb = webpackEnv.contains("web") || isTargetAll && !isWds;
  const isTargetElectron = webpackEnv.contains("electron") || isTargetAll && !isWds;


  // Avoid problems with WDS serving web and electron-renderer at the same time
  const isWebAllowed = !(isTargetElectron && isWds);

  // Other env
  const shouldUseSourceMap = webpackEnv.contains("sourcemap");
  const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== "false";
  const imageInlineSizeLimit = 10000;

  // Define application environment if it was not defined by developer
  if (!process.env["NODE_CONFIG_ENV"]) {
    process.env["NODE_CONFIG_ENV"] = isEnvDevelopment ? "development" : "production";
  }

  const appConfig = require("config");

  if (isEnvDevelopment && isEnvProduction) {
    throw new Error(
      "Provided invalid environment options\n isEnvDevelopment and isEnvProduction options both are set to true",
    );
  }

  if (!isTargetAll && !isTargetWeb && !isTargetElectron) {
    throw new Error("Build target platform not specified");
  }

  if (isEnvDevelopment && isTargetAll) {
    throw new Error("User only one target platform in development environment");
  }

  process.env.NODE_ENV =
    process.env.NODE_ENV || isEnvProduction
      ? "production"
      : isEnvDevelopment
        ? "development"
        : undefined;

  const storageProfile =
      process.env["STORAGE_PROFILE"] || isEnvDevelopment ? "development" : "" ;

  const WDS_HOST = "localhost";
  const WDS_PORT = await detectPort(process.env.PORT || 3000, WDS_HOST);

  process.env.WDS_HOST = WDS_HOST;
  process.env.WDS_PORT = WDS_PORT;
  process.env.WDS_URL = `http://localhost:${WDS_PORT}`;

  const createElectronBuilderHook = () => {
    const desktopBundleStatus = {
      main: false,
      preload: false,
      renderer: false,
    };

    let electronBuilderStarted = false;

    /**
     *
     * @param {import("webpack").Stats} stats
     * @param {Function} callback
     */
    return async (stats, callback) => {
      const name = stats.compilation.name;
      console.log(`---- Bundle for ${name} is done! ----`);
      if (Object.prototype.hasOwnProperty.call(desktopBundleStatus, name)) {
        desktopBundleStatus[name] = true;
      }

      if (Object.values(desktopBundleStatus).filter(s => !s).length === 0 && !electronBuilderStarted) {
        try {
          electronBuilderStarted = true;
          console.log("---- Starting electron-builder ----");

          const builder = require("electron-builder");
          await builder.build({ config: paths.electron.builderConfig });

          console.log("--- Desktop build done ---");
        } catch (e) {
          callback(e);
        }

      };
      callback();
    };
  };

  /**
   * Common configuration that would be merged to other configs.
   * @type {import("webpack").Configuration}
   */
  const commonConfig = {
    mode: isEnvProduction ? "production" : isEnvDevelopment && "development",
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? "source-map"
        : false
      : isEnvDevelopment && "cheap-module-source-map",
    watch: isEnvDevelopment,
    watchOptions: {
      ignored: /node_modules/,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx"],
      alias: {
        // Global alias to src dir for hole project.
        "@": paths.appSrc,
      },
      plugins: [
        PnpWebpackPlugin,
        new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
      ],
    },
    resolveLoader: {
      plugins: [PnpWebpackPlugin.moduleLoader(module)],
    },
    module: {
      strictExportPresence: true,
      rules: [{ parser: { requireEnsure: false } }],
    },
    optimization: {
      minimize: isEnvProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            parse: {
              ecma: 8,
            },
            compress: {
              ecma: 5,
              warnings: false,
              comparisons: false,
              inline: 2,
            },
            mangle: {
              safari10: true,
            },
            output: {
              ecma: 5,
              comments: false,
              ascii_only: true,
            },
          },
          // Not work in WSL
          parallel: true,
          cache: true,
          sourceMap: shouldUseSourceMap,
          extractComments: false,
        }),
      ],
      removeEmptyChunks: true,
    },
    plugins: [
      isEnvProduction && new HooksPlugin({
        "done@": createElectronBuilderHook(),
      }),
      new ESLintPlugin({
        files: "src/*",
      }),
      // We use DotEnvPlugin to load env from .env file
      // EnvironmentPlugin for NODE_ENV and DEBUG variables
      new DotEnvPlugin({
        silent: true,
      }),
      new EnvironmentPlugin({
        NODE_ENV: "development",
        DEBUG: false,
      }),
      isEnvProduction &&
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
        logLevel: "silent",
        openAnalyzer: false,
      }),
      new DefinePlugin({
        APP_NAME: JSON.stringify(packageJson.name),
        APP_VERSION: JSON.stringify(packageJson.version),
      }),
    ].filter(Boolean),
    devServer: {
      compress: true,
      port: WDS_PORT,
      host: WDS_HOST,
      noInfo: true,
      hot: true,
      open: false,
      injectHot: compilerConfig => compilerConfig.name === "renderer",
      writeToDisk: path => {
        return /app\/(preload\/.+|main.js|.+\.json)/i.test(path);
      },
    },
  };

  /**
   * Common config for electron-main and electron-preload
   * @type {import("webpack").Configuration}
   */
  const electronCommonConfig = {
    module: {
      rules: [
        // TODO?: Add babel loader if it would be required
        {
          test: /\.m?(j|t)sx?$/,
          use: [
            {
              loader: "ts-loader",
            },
          ],
        },
      ],
    },
    externals: nodeExternals(),
    plugins: [
      // Define plugin to define variables like PLATFORM in entry specific config
      new DefinePlugin({
        PLATFORM: JSON.stringify("desktop"),
        STORAGE_PROFILE: JSON.stringify(storageProfile),
        DEFAULT_CONFIG: JSON.stringify(appConfig),
      }),
    ].filter(Boolean),
    node: {
      __dirname: false,
    },
  };

  /**
   * Final config for electron-main
   * @type {import("webpack").Configuration}
   */
  const electronMainConfig = {
    name: "main",
    entry: paths.electron.main.entry,
    output: paths.electron.main.output,
    target: "electron-main",
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: paths.appPkg,
            to: ".",
            transform: (buffer) => {
              const pkg = pick(JSON.parse(buffer.toString()), [
                "name",
                "version",
                "description",
                "license",
                "private",
                "author",
                "main",
                "dependencies",
              ]);
              // Electron main process entry point.
              pkg.main = "main.js";
              return Buffer.from(JSON.stringify(pkg, null, isEnvDevelopment ? 2 : 0 ));
            },
            cacheTransform: true,
          },
        ],
      }),
      isEnvDevelopment && new NodemonPlugin({
        script: resolve(paths.electron.main.output.path, "main.js"),
        watch: paths.electron.main.output.path,
        ignore: ["*.js.map"],
        verbose: false,
        execMap: {
          js: resolve(paths.appNodeModules, "electron/cli.js"),
        },
      }),
    ].filter(Boolean),
  };

  /**
   * Final config for electron-preload
   * @type {import("webpack").Configuration}
   */
  const electronPreloadConfig = {
    name: "preload",
    entry: paths.electron.preload.entry,
    output: paths.electron.preload.output,
    target: "electron-preload",
    devtool: "inline-source-map",
  };

  /**
   * Common config for UI bundles.
   * @type {import("webpack").Configuration}
   */
  const commonUiConfig = {
    target: "web",
    mode: isEnvDevelopment ? "development" : "production",
    module: {
      strictExportPresence: true,
      rules: [
        {
          oneOf: [
            // "url" loader works like "file" loader except that it embeds assets
            // smaller than specified limit in bytes as data URLs to avoid requests.
            // A missing `test` is equivalent to a match.
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: "url-loader",
              options: {
                limit: imageInlineSizeLimit,
                name: "static/media/[name].[hash:8].[ext]",
              },
            },
            // TODO?: Customize babel configuration here
            // Process application JS with Babel.
            // The preset includes JSX, Flow, TypeScript, and some ESnext features.
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: paths.appSrc,
              loader: "babel-loader",
              options: {
                customize: require.resolve("babel-preset-react-app/webpack-overrides"),
                babelrc: false,
                configFile: false,
                presets: ["babel-preset-react-app"],
                plugins: [
                  [
                    require.resolve("babel-plugin-named-asset-import"),
                    {
                      loaderMap: {
                        svg: {
                          ReactComponent:
                            "@svgr/webpack?-svgo,+titleProp,+ref![path]",
                        },
                      },
                    },
                  ],
                ],
                // This is a feature of `babel-loader` for webpack (not Babel itself).
                // It enables caching results in ./node_modules/.cache/babel-loader/
                // directory for faster rebuilds.
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                compact: isEnvProduction,
              },
            },
            // Process any JS outside of the app with Babel.
            // Unlike the application JS, we only compile the standard ES features.
            {
              test: /\.(js|mjs)$/,
              exclude: /@babel(?:\/|\\{1,2})runtime/,
              loader: "babel-loader",
              options: {
                babelrc: false,
                configFile: false,
                compact: false,
                presets: [
                  [
                    "babel-preset-react-app/dependencies",
                    { helpers: true },
                  ],
                ],
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                // If an error happens in a package, it's possible to be
                // because it was compiled. Thus, we don't want the browser
                // debugger to show the original code. Instead, the code
                // being evaluated would be much more helpful.
                sourceMaps: false,
              },
            },
            // Process css with postcss.
            {
              test: /\.css$/,
              use: [
                isEnvDevelopment && require.resolve("style-loader"),
                isEnvProduction && {
                  loader: MiniCssExtractPlugin.loader,
                },
                {
                  loader: "css-loader",
                  options: {
                    importLoaders: 1,
                    sourceMap: isEnvProduction && shouldUseSourceMap,
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                  options: {
                    ident: "postcss",
                    plugins: () => [
                      require("postcss-flexbugs-fixes"),
                      require("postcss-preset-env")({
                        autoprefixer: {
                          flexbox: "no-2009",
                        },
                        stage: 3,
                      }),
                      postcssNormalize(),
                    ],
                    sourceMap: isEnvProduction && shouldUseSourceMap,
                  },
                },
              ].filter(Boolean),
              sideEffects: true,
            },

            // "file" loader makes sure those assets get served by WebpackDevServer.
            // When you `import` an asset, you get its (virtual) filename.
            // In production, they would get copied to the `build` folder.
            // This loader doesn't use a "test" so it will catch all modules
            // that fall through the other loaders.
            {
              loader: require.resolve("file-loader"),
              // Exclude `js` files to keep "css" loader working as it injects
              // its runtime that would otherwise be processed through "file" loader.
              // Also exclude `html` and `json` extensions so they get processed
              // by webpacks internal loaders.
              exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              options: {
                name: "static/media/[name].[hash:8].[ext]",
              },
            },
            // ** STOP ** Are you adding a new loader?
            // Make sure to add the new loader(s) before the "file" loader.
          ],
        },
      ],
    },
    plugins: [
      // Generates an `index.html` file with the <script> injected.
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            template: paths.appHtml,
          },
          isEnvProduction
            ? {
              minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
              },
            }
            : undefined,
        ),
      ),
      new CspHtmlWebpackPlugin(csp),
      isEnvProduction &&
        shouldInlineRuntimeChunk &&
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
      new ModuleNotFoundPlugin(paths.appPath),
      isEnvDevelopment && new HotModuleReplacementPlugin(),
      isEnvDevelopment && new CaseSensitivePathsPlugin(),
      isEnvDevelopment &&
        new WatchMissingNodeModulesPlugin(paths.appNodeModules),
      isEnvProduction &&
        new MiniCssExtractPlugin({
          // Options similar to the same options in webpackOptions.output
          // both options are optional
          filename: "static/css/[name].[contenthash:8].css",
          chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
        }),
    ].filter(Boolean),
    node: {
      module: "empty",
      dgram: "empty",
      dns: "mock",
      fs: "empty",
      http2: "empty",
      net: "empty",
      tls: "empty",
      child_process: "empty",
    },
  };

  /**
   * Config for electron's UI bundle.
   * @type {import("webpack").Configuration}
   */
  const electronRendererConfig = {
    name: "renderer",
    entry: paths.electron.renderer.entry,
    output: isWds ? paths.electron.renderer.wdsOutput : paths.electron.renderer.output,
    plugins: [
      new DefinePlugin({
        "PLATFORM": JSON.stringify("desktop"),
      }),
    ],
  };

  /**
   * Config for web version.
   * @type {import("webpack").Configuration}
   */
  const webConfig = {
    name: "web",
    entry: paths.web.entry,
    output: paths.web.output,
    plugins: [
      new DefinePlugin({
        "PLATFORM": JSON.stringify("web"),
      }),
    ],
  };

  return [
    isTargetElectron && merge(commonConfig, commonUiConfig, electronRendererConfig),
    isTargetElectron && merge(commonConfig, electronCommonConfig, electronPreloadConfig),
    isTargetElectron && merge(commonConfig, electronCommonConfig, electronMainConfig),
    isWebAllowed && isTargetWeb && merge(commonConfig, commonUiConfig, webConfig),
  ].filter(Boolean);
};
