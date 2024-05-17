import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthContextProvider } from "./contexts/AuthContextProvider.tsx"
import Home from "./pages/home.jsx"
import { ThemeProvider } from "./contexts/ThemeProvider.tsx"
import { Signup } from "./pages/signup.tsx"
import { HeaderLayout } from "./components/layouts/header/HeaderLayout.tsx"
import { OTP } from "./pages/otp.tsx"
import { Login } from "./pages/login.tsx"
import { Toaster } from "@/components/ui/sonner.tsx"
import { Blogs } from "./pages/blogs.tsx"
import { BlogPage } from "./pages/[username]/[blog]/page.tsx"
import { WritePage } from "./pages/write.tsx"
import { PrivateRoute } from "./components/common/PrivateRoute.tsx"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ProfilePage } from "./pages/[username]/page.tsx"
import { ChooseCategories } from "./pages/choose-categories.tsx"

const browserRouter = createBrowserRouter([
  {
    element: <HeaderLayout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/signup",
        element: <Signup />,
      },
      {
        path: "/otp",
        element: <OTP />,
      },
      {
        path: "/choose-categories",
        element: <ChooseCategories />,
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/blogs",
        element: <Blogs />,
      },
      {
        path: "/write",
        element: (
          <PrivateRoute>
            <WritePage />
          </PrivateRoute>
        ),
      },
      {
        path: "/:username",
        element: <ProfilePage />,
      },
      {
        path: "/:username/:title",
        element: <BlogPage />,
      },
    ],
  },
])
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthContextProvider>
          <RouterProvider router={browserRouter} />
        </AuthContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
    <ReactQueryDevtools client={queryClient} />
    <Toaster />
  </React.StrictMode>
)
