# electron-react-template
This is template repository with flexible configuration based on webpack.
Here you would have fully pre-configured configuration to build secure application based on electron.
In this template I have used `react`.
You can easy replace it with any other front-end framework that you prefer.

## Environment
> TODO

## Scripts
> TODO

## Debug
> TODO

### Runtime environment variables
Runtime environment variables must be defined and build-time.
`DEBUG` and `NODE_ENV` are predefined in `webpack.config.js`.
Other variables can  be defined with local `.env` file. They would be hardcoded in bundle.

## Structure
Structure of project directories.

> `@` is global alias to src directory

* configs - application configs
* docs - src docs
* src - project src
  * assets - dynamic assets
  * components - UI components
  * electron - desktop-specific code
    * main
      * index.ts
      * ...main process modules
    * preload
      * modules
      * index.ts
      * ...other preload scripts
    * renderer - exports renderer specific modules.
  * types - type definitions for project.
  * views - UI views
    * %viewName%
      * components - page specific components
      * container.js - %viewName% root
  * web - web specific modules
  * store
  * main.js - UI entry point
* static - static assets
