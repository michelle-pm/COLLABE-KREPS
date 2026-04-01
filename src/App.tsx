/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FirebaseProvider, useAuth } from "./components/FirebaseProvider";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Friends } from "./pages/Friends";
import { Messages } from "./pages/Messages";
import { Projects } from "./pages/Projects";
import { ProjectDetails } from "./pages/ProjectDetails";
import { Settings } from "./pages/Settings";
import { Auth } from "./pages/Auth";
import { Toaster } from "sonner";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <FirebaseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="friends" element={<Friends />} />
            <Route path="messages" element={<Messages />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" />
    </FirebaseProvider>
  );
}

