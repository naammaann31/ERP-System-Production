import { AuthProvider } from "@/components/providers/AuthProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ProtectedRoute>
                <SidebarProvider>
                    <div className="flex h-screen bg-slate-50 overflow-hidden">
                        <Sidebar />
                        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                            <Navbar />
                            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {children}
                            </main>
                        </div>
                    </div>
                </SidebarProvider>
            </ProtectedRoute>
        </AuthProvider>
    );
}
