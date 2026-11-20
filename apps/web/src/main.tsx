import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApi, loseFirstResponse, type FetchLike } from "./api";
import { App } from "./App";
import "./styles.css";

const browserFetch: FetchLike = (url, init) => fetch(url, init);
const flaky = new URLSearchParams(window.location.search).has("flaky");
const api = createApi(flaky ? loseFirstResponse(browserFetch) : browserFetch);

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

createRoot(root).render(
  <StrictMode>
    <App api={api} flaky={flaky} />
  </StrictMode>,
);
