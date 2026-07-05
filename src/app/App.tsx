import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { router } from "./router";

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
