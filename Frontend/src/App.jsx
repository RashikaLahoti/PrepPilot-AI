import { RouterProvider } from "react-router";
import { Toaster } from "react-hot-toast";
import { router } from "./app.routes.jsx";
import { AuthProvider } from "./features/auth/auth.context.jsx";
import { InterviewProvider } from "./features/interview/interview.context.jsx";

function App() {
  return (
    <AuthProvider>
      <InterviewProvider>
        <Toaster
          position="top-right"
          containerStyle={{
            top: 24,
            right: 24,
            zIndex: 99999,
          }}
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e2535",
              color: "#e6edf3",
              border: "1px solid #2a3348",
              borderRadius: "0.75rem",
              padding: "12px 16px",
              fontSize: "0.875rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            },
            success: {
              duration: 3500,
              iconTheme: {
                primary: "#10b981",
                secondary: "#1e2535",
              },
            },
            error: {
              duration: 4500,
              iconTheme: {
                primary: "#ef4444",
                secondary: "#1e2535",
              },
            },
          }}
        />
        <RouterProvider router={router} />
      </InterviewProvider>
    </AuthProvider>
  );
}

export default App;

