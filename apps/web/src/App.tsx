import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CreatePage } from "./pages/CreatePage";
import { JoinPage } from "./pages/JoinPage";
import { RoomPage } from "./pages/RoomPage";

export const App = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/create" element={<CreatePage />} />
    <Route path="/join" element={<JoinPage />} />
    <Route path="/room/:code" element={<RoomPage />} />
    <Route path="*" element={<HomePage />} />
  </Routes>
);
