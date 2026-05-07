import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import HomePage from "./pages/HomePage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path={ROUTES.HOW_IT_WORKS}
            element={<PlaceholderPage title="How It Works" />}
          />
          <Route
            path={ROUTES.FEATURES}
            element={<PlaceholderPage title="Features" />}
          />
          <Route
            path={ROUTES.ABOUT}
            element={<PlaceholderPage title="About" />}
          />
          <Route
            path={ROUTES.PRICING}
            element={<PlaceholderPage title="Pricing" />}
          />
          <Route
            path={ROUTES.LOGIN}
            element={
              <PlaceholderPage
                title="Log In"
                description="Login page — coming soon."
              />
            }
          />
          <Route
            path={ROUTES.REGISTER}
            element={
              <PlaceholderPage
                title="Create Account"
                description="Registration — coming soon."
              />
            }
          />
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <PlaceholderPage
                title="Dashboard"
                description="Dashboard — coming soon."
              />
            }
          />
          <Route
            path={ROUTES.EDITOR}
            element={
              <PlaceholderPage
                title="Sessions"
                description="Session list — coming soon."
              />
            }
          />
          <Route
            path={ROUTES.EDITOR_NEW}
            element={
              <PlaceholderPage
                title="New Session"
                description="Editor — coming soon."
              />
            }
          />
          <Route
            path={ROUTES.NOT_FOUND}
            element={
              <PlaceholderPage
                title="Page not found"
                description="The page you're looking for doesn't exist."
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
