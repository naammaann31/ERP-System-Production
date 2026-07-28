export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="relative h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
            {/* Full-screen background video (Shared so it doesn't unmount on route change) */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="absolute inset-0 h-full w-full object-cover"
                >
                    <source src="/videos/hero-bg.mp4" type="video/mp4" />
                </video>

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            </div>
            
            {/* Content (Login or Signup Form) */}
            {children}
        </main>
    );
}
