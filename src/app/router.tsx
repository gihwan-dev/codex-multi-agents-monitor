import { createBrowserRouter, Navigate } from "react-router-dom";

import { RootLayout } from "@/app/shell/root-layout";
import { ArchivePage } from "@/pages/archive/archive-page";
import { LegacyThreadRedirectPage } from "@/pages/legacy-thread-redirect/legacy-thread-redirect-page";
import { LivePage } from "@/pages/live/live-page";
import { NotFoundPage } from "@/pages/not-found/not-found-page";
import { SummaryPage } from "@/pages/summary/summary-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/live" replace /> },
      { path: "live", element: <LivePage /> },
      { path: "live/:sessionId", element: <LivePage /> },
      { path: "archive", element: <ArchivePage /> },
      { path: "archive/:sessionId", element: <ArchivePage /> },
      { path: "summary", element: <SummaryPage /> },
      { path: "threads/:threadId", element: <LegacyThreadRedirectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
