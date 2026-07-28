import { ReactNode } from "react";

interface DashboardCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    trend?: string;
    trendUp?: boolean;
}

export default function DashboardCard({ title, value, icon, trend, trendUp }: DashboardCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 p-6 flex flex-col transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">{title}</h3>
                <div className="text-blue-600 bg-blue-50/80 p-2.5 rounded-xl border border-blue-100/50 shadow-sm">{icon}</div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
                {trend && (
                    <span className={`text-sm font-semibold ${trendUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {trend}
                    </span>
                )}
            </div>
        </div>
    );
}
