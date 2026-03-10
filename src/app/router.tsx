import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/shell/root-layout";
import { HistoryPage } from "@/pages/history/history-page";
import { NotFoundPage } from "@/pages/not-found/not-found-page";
import { OverviewPage } from "@/pages/overview/overview-page";
import { ThreadDetailPage } from "@/pages/thread-detail/thread-detail-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "threads/:threadId", element: <ThreadDetailPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
