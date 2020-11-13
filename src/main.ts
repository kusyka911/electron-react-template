import ReactDOM from "react-dom";
import { ReactElement } from "react";
import { App } from "@/views/App";

ReactDOM.render(App() as ReactElement, document.getElementById("app"));

if (module.hot) {
  module.hot.accept();
}
