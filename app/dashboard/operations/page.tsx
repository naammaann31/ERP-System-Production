import OperationsClient from "../../../components/dashboard/OperationsClient";

export const metadata = {
    title: "Operations | Vectra Group ERP",
    description: "Sales operations and candidate tracking",
};

export default function OperationsPage() {
    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Operations</h1>
                <p className="text-sm text-slate-500">Sales lead & candidate tracking</p>
            </div>
            
            <OperationsClient />
        </div>
    );
}
