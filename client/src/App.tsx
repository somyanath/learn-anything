import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Topic } from "./pages/Topic";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/topics/:slug" element={<Topic />} />
      </Routes>
    </BrowserRouter>
  );
}
