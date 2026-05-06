import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}></Route>
      </Routes>
    </BrowserRouter>
  );
}
