import React from "react";
import { createRoot } from "react-dom/client";
import { Link } from "react-router-dom";
import App from "../../src/App";
import "../../src/globals.css";

// App, routes, guards, LoteNovo and navigation are real; services are isolated by the spec.
Object.assign(window, { React, UX08Link: Link });
createRoot(document.getElementById("root")!).render(<App />);
