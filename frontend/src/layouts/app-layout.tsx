import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/navigation/sidebar";
import { BottomNav } from "../components/navigation/bottom-nav";

export const AppLayout = () => (
  <div className="flex min-h-screen bg-transparent">
    <Sidebar />
    <div className="flex w-full flex-col">
      <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
        <Outlet />
      </main>
    </div>
    <BottomNav />
  </div>
);
