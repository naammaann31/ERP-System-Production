"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
    isOpen: boolean;
    toggleSidebar: () => void;
    setIsOpen: (isOpen: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(true);

    // Optional: read from localStorage or media query in real implementation
    // Defaulting to true for now.

    const toggleSidebar = () => setIsOpen((prev) => !prev);

    return (
        <SidebarContext.Provider value={{ isOpen, toggleSidebar, setIsOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
