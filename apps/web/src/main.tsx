import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RoomStoreProvider } from "./hooks/useRoomStore";
import { AudioSettingsProvider } from "./hooks/useAudioSettings";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <AudioSettingsProvider>
        <RoomStoreProvider>
          <App />
        </RoomStoreProvider>
      </AudioSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
